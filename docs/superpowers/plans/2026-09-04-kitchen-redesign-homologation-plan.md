# Gestão Delivery — Kitchen Redesign and Homologation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Cozinha screen with high fidelity to the approved “Opção A — Ticket clássico” mockup and close every scheduled-order, timing, details, printing-copy, and dark-theme issue found in staging homologation.

**Architecture:** Keep persisted order and print-job lifecycles unchanged. Move kitchen classification, ordering, counters, timing copy, and the next temporal boundary into pure tested helpers; expose one React clock that schedules the exact next `operationalStartAt` and feeds both rendering and one-time arrival alerts. Split the visual work into focused `KitchenTicket`, item-note summary, timing-detail, and printing-settings surfaces, all backed by the existing internal icons and semantic theme tokens.

**Tech Stack:** React 19, Vite 8, Node.js built-in test runner, plain CSS with existing semantic theme tokens, Cloudflare Workers/D1, Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-04-kitchen-redesign-homologation-design.md`, with timing rules from `docs/superpowers/specs/2026-09-04-scheduled-orders-operational-timing-design.md` and print-job contracts from `docs/superpowers/specs/2026-09-03-order-printing-escpos-design.md`.

**Visual reference:** The attached chat image, left panel “A. Ticket clássico (Recomendado)”, is the official visual source. Keep it visible during Tasks 4, 5, and 9; the textual spec narrows behavior but does not permit a free redesign.

## Global Constraints

- Work only from `origin/feature/scheduled-orders-operational-timing`; never alter `master`.
- Use a new isolated worktree; do not reset, restore, clean, stash, or repair the original dirty/divergent checkout.
- Follow strict TDD for every behavior change: add one focused RED test, run it and record the intended failure, implement the minimum GREEN change, rerun the focused test, then refactor while green.
- `Agendado para preparo` is derived presentation only; do not add a persisted order status, endpoint, cron, or migration for that transition.
- `Fora do prazo` is an additional signal, never a third persisted queue.
- Keep `SCHEDULED_PREP_LEAD_MINUTES = 50` and `SCHEDULED_LATE_GRACE_MINUTES = 15` centralized in `shared/orderTiming.js`.
- Item production notes come only from `item.note`; do not add an order-level note to schema, API, payload, or UI state.
- Do not add an icon dependency; extend `src/components/Icon.jsx` with matching rounded SVG strokes.
- Do not change print-job lifecycle, claim, station, retry, or transport rules except where a failing regression test proves the approved contract is not met.
- Map technical `printed` to the UI text `Enviado para impressão`; do not claim physical paper confirmation.
- Scheduled manual printing creates a new `manual` job and must leave the future `automatic` job unchanged and eligible at `availableAt`.
- Preserve keyboard access, visible focus, reduced motion, touch targets of at least `44px`, and a 320–480 px layout without horizontal scrolling.
- No production migration, production dry-run deployment with writes, production deploy, or production smoke test is authorized.
- Staging may be updated only after the full local gate and a review checkpoint; production remains blocked until a new explicit manual homologation and authorization.

## File Structure

### New focused files

- `src/utils/kitchenQueue.js`: pure filtering, search, classification, fixed ordering, counters, and next transition selection.
- `src/utils/kitchenQueue.test.js`: behavioral boundary, ordering, counter, and search tests.
- `src/utils/kitchenTicket.js`: pure item-summary, item-note, and timing-copy view models.
- `src/utils/kitchenTicket.test.js`: real-value tests for summaries, note association, and time wording.
- `src/hooks/useKitchenClock.js`: React lifecycle wrapper for exact next-boundary timeout plus minute/focus/visibility fallbacks.
- `src/hooks/useKitchenClock.test.js`: structural integration guard; timer mechanics remain behaviorally tested through injected helpers in `kitchenQueue.test.js`.
- `src/components/KitchenTicket.jsx`: presentational ticket and state-specific actions; no API or date-rule decisions.
- `src/components/KitchenTicketNotes.jsx`: at-most-two-line ticket note block built from the complete item-note view model.
- `src/components/KitchenTicket.test.js`: ticket content/action/privacy regression tests.
- `src/components/OrderDetailTiming.jsx`: semantic `<dl>` block for desired time, operational start, and completion duration.
- `src/components/OrderDetailTiming.test.js`: pure timing-row and semantic markup checks.
- `src/kitchenRedesignRegression.test.js`: high-level copy, component wiring, icon, privacy, and theme-boundary regressions.

### Existing files to modify

- `src/pages/Orders.jsx`: consume the clock and queue view model; compose compact header, four counters, two persistent queues, tickets, dialogs, and printing settings.
- `src/App.jsx`: own the kitchen clock while Cozinha is active and make one-time alerts react to either new order data or a clock boundary.
- `src/utils/orderWorkflow.js`: make the existing `isFinishedToday` comparison explicit in the operational business timezone.
- `src/utils/orderRealtime.js` and `src/utils/orderRealtime.test.js`: keep operational arrival detection pure and prove boundary crossings are emitted once.
- `src/components/Icon.jsx`: add the approved kitchen-specific SVG names.
- `src/components/StatCard.jsx`: accept an optional class name/compact presentation without changing current consumers.
- `src/components/OrderDetail.jsx`: reorder detail sections, use semantic timing rows, preserve complete item notes, move active-preparation cancellation inside details, and clarify print actions.
- `src/components/PrintStatusBadge.jsx`: change only the user-facing `printed` label.
- `src/components/PrintingSettings.jsx`: add stable semantic classes/field grouping where CSS needs them.
- `src/order-operations.css`: replace the old queue-card design with the ticket composition and detail layout.
- `src/order-operations-compact.css`: preserve 320–480 px identity, 2 × 2 counters, full-text actions, and no overflow.
- `src/printing/printing.css`: remove light-only fallbacks and cover dark/light, focus, hover, disabled, and mobile states.
- `src/index.css`: define centralized kitchen-local semantic surface/status tokens for both themes.
- Existing tests in `src/pages/OrdersScheduled.test.js`, `src/pages/OrdersMobile.test.js`, `src/pages/OrdersMultiItem.test.js`, `src/components/PrintingSettings.test.js`, `src/printing/printingUi.test.js`, `src/kitchenLiveRefresh.test.js`, and `src/orderTimerRefresh.test.js`: update expectations only in the task that changes the contract.
- `worker/orderPrintingRepository.test.js` and `worker/orderPrintingHttp.test.js`: add coexistence/eligibility regressions for manual and future automatic jobs; production repository/API code changes only if those tests expose a real defect.

---

### Task 1: Extract the kitchen queue and temporal-boundary domain

**Files:**
- Create: `src/utils/kitchenQueue.js`
- Create: `src/utils/kitchenQueue.test.js`
- Modify: `shared/orderTiming.test.js`
- Modify: `src/utils/orderWorkflow.js`
- Modify: `src/utils/orderWorkflow.test.js`

**Interfaces:**
- Consumes: `isOrderActive(order)`, `isScheduledWaiting(order, now)`, `getOperationalStartAt(order)`, `getOrderTimingState(order, now)`, `isFinishedToday(order, now)`, and `getOrderItemsSearchText(order)`.
- Produces: `buildKitchenQueueModel(orders, now, search) -> { preparing, scheduled, counts, totalVisible }`, where each entry is `{ order, phase, operationalStartAt, timingState, isLate }`.
- Produces: `getNextKitchenTransitionAt(orders, now) -> Date | null` and `scheduleKitchenTransition(orders, now, onTransition, timers) -> cleanup()`.

- [ ] **Step 1: Write RED boundary and exclusivity tests.**

```js
test('each active order belongs to exactly one main queue at the boundary', () => {
  const before = new Date('2026-09-04T14:09:59.999Z')
  const atStart = new Date('2026-09-04T14:10:00.000Z')
  const ids = (entries) => entries.map(({ order }) => order.id)
  assert.deepEqual(ids(buildKitchenQueueModel([scheduledOrder], before, '').scheduled), ['scheduled-1'])
  assert.deepEqual(ids(buildKitchenQueueModel([scheduledOrder], before, '').preparing), [])
  assert.deepEqual(ids(buildKitchenQueueModel([scheduledOrder], atStart, '').scheduled), [])
  assert.deepEqual(ids(buildKitchenQueueModel([scheduledOrder], atStart, '').preparing), ['scheduled-1'])
})

test('late is an additional flag and never creates a third queue', () => {
  const model = buildKitchenQueueModel([lateImmediate, lateScheduled], new Date('2026-09-04T15:16:00Z'), '')
  assert.equal(model.preparing.length, 2)
  assert.equal(model.counts.late, 2)
  assert.equal(Object.hasOwn(model, 'late'), false)
})
```

- [ ] **Step 2: Run the new test and verify RED.**

Run: `node --test src/utils/kitchenQueue.test.js`

Expected: FAIL because `src/utils/kitchenQueue.js` and `buildKitchenQueueModel` do not exist.

- [ ] **Step 3: Implement the minimum queue model.**

```js
export const buildKitchenQueueModel = (orders = [], now = new Date(), search = '') => {
  const normalizedSearch = normalizeSearch(search)
  const active = orders.filter(isOrderActive).filter((order) => matchesKitchenSearch(order, normalizedSearch))
  const entries = active.map((order) => {
    const phase = isScheduledWaiting(order, now) ? 'scheduled' : 'preparing'
    const timingState = getOrderTimingState(order, now)
    return { order, phase, operationalStartAt: getOperationalStartAt(order), timingState, isLate: timingState !== 'on-time' }
  })
  const preparing = entries.filter(({ phase }) => phase === 'preparing').sort(compareOperationalStart)
  const scheduled = entries.filter(({ phase }) => phase === 'scheduled').sort(compareScheduledFor)
  return {
    preparing,
    scheduled,
    totalVisible: entries.length,
    counts: {
      preparing: preparing.length,
      scheduled: scheduled.length,
      late: entries.filter(({ isLate }) => isLate).length,
      finishedToday: orders.filter((order) => order.status === 'Finalizado' && isFinishedToday(order, now)).length,
    },
  }
}
```

- [ ] **Step 4: Add RED ordering/search/counter tests.** Cover immediate orders by oldest `operationalStartAt`, scheduled orders by nearest `scheduledFor`, stable ID tie-breaks, final/cancelled exclusion, finalizados hoje in the business-day behavior already used by `isFinishedToday`, and search by client, full order ID/last four digits, product, and attendance type.

```js
const ids = (entries) => entries.map(({ order }) => order.id)
assert.deepEqual(ids(model.preparing), ['old-operational', 'new-operational'])
assert.deepEqual(ids(model.scheduled), ['desired-1200', 'desired-1230'])
assert.deepEqual(ids(buildKitchenQueueModel(fixtures, now, '1048').preparing), ['order-1048'])
assert.deepEqual(ids(buildKitchenQueueModel(fixtures, now, 'pudim').preparing), ['order-1048'])
assert.deepEqual(model.counts, { preparing: 2, scheduled: 2, late: 1, finishedToday: 1 })
```

- [ ] **Step 5: Add a RED business-timezone test for `Finalizados hoje`.** Use a completion timestamp that is the next UTC date but still the current date in `America/Sao_Paulo`; update `isFinishedToday` to compare `getBusinessDate(finishedAt)` with `getBusinessDate(now)`, not browser-local date parts.

- [ ] **Step 6: Run the focused tests, implement exact search/order/count behavior, and verify GREEN.**

Run: `node --test src/utils/kitchenQueue.test.js shared/orderTiming.test.js src/utils/orderWorkflow.test.js`

Expected: PASS with deterministic São Paulo fixtures and no duplicated `50`/`15` constants.

- [ ] **Step 7: Add RED next-boundary and timer tests with injected timers.**

```js
test('schedules only the nearest future operational start and cleanup clears it', () => {
  const calls = []
  const cleared = []
  const cleanup = scheduleKitchenTransition(orders, now, onTransition, {
    setTimeout: (fn, delay) => { calls.push({ fn, delay }); return 42 },
    clearTimeout: (id) => cleared.push(id),
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].delay, 10 * 60_000)
  calls[0].fn()
  assert.equal(transitions, 1)
  cleanup()
  assert.deepEqual(cleared, [42])
})
```

- [ ] **Step 8: Implement `getNextKitchenTransitionAt` and `scheduleKitchenTransition`; rerun RED → GREEN.** Ignore inactive, cancelled, finished, invalid, past, and later boundaries; clamp delay to non-negative values and return a no-op cleanup when no future transition exists.

- [ ] **Step 9: Commit the independently testable domain.**

```bash
git add src/utils/kitchenQueue.js src/utils/kitchenQueue.test.js shared/orderTiming.test.js src/utils/orderWorkflow.js src/utils/orderWorkflow.test.js
git commit -m "refactor: extract kitchen queue timing model"
```

### Task 2: Drive rendering and arrival alerts from the exact kitchen clock

**Files:**
- Create: `src/hooks/useKitchenClock.js`
- Create: `src/hooks/useKitchenClock.test.js`
- Modify: `src/App.jsx`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/utils/orderRealtime.js`
- Modify: `src/utils/orderRealtime.test.js`
- Modify: `src/kitchenLiveRefresh.test.js`
- Modify: `src/orderTimerRefresh.test.js`

**Interfaces:**
- Consumes: `scheduleKitchenTransition(orders, now, onTransition, timers)` from Task 1.
- Produces: `useKitchenClock(orders, { active }) -> Date`.
- Produces: `detectOperationalArrivals(previousIds, orders, now, alertedIds) -> { currentIds, newIds }`; this stays pure and is used by one App effect.
- `Orders` gains required prop `now`; it no longer owns a separate clock.

- [ ] **Step 1: Write a RED hook-structure test.**

```js
test('kitchen clock combines exact timeout with minute and resume fallbacks', async () => {
  const source = await read('./useKitchenClock.js')
  assert.match(source, /scheduleKitchenTransition/)
  assert.match(source, /setInterval[\s\S]*60_000/)
  assert.match(source, /visibilitychange/)
  assert.match(source, /focus/)
  assert.match(source, /clearInterval/)
})
```

- [ ] **Step 2: Run the hook and refresh tests and verify RED.**

Run: `node --test src/hooks/useKitchenClock.test.js src/orderTimerRefresh.test.js`

Expected: FAIL because the hook does not exist and `Orders.jsx` still owns the minute-only timer.

- [ ] **Step 3: Implement the hook with explicit cleanup.**

```js
export function useKitchenClock(orders, { active = true } = {}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return undefined
    const refresh = () => setNow(new Date())
    const clearTransition = scheduleKitchenTransition(orders, new Date(), refresh)
    const fallback = globalThis.setInterval(refresh, 60_000)
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisibility)
    globalThis.addEventListener('focus', refresh)
    return () => {
      clearTransition()
      globalThis.clearInterval(fallback)
      document.removeEventListener('visibilitychange', onVisibility)
      globalThis.removeEventListener('focus', refresh)
    }
  }, [active, orders])
  return now
}
```

- [ ] **Step 4: Add RED arrival tests.** Prove a scheduled order is absent one millisecond before the boundary, appears exactly at the boundary, produces one `newId`, and is suppressed by `alertedIds` on later clock ticks. Prove initialization after the boundary seeds current IDs and produces no retroactive alert.

- [ ] **Step 5: Implement the pure arrival result and verify GREEN.** Keep `operationalOrderIdSet` as the source of membership; do not introduce a second time rule.

- [ ] **Step 6: Add a RED App integration guard.** Require `useKitchenClock`, `kitchenNow`, `now={kitchenNow}`, and one alert effect that depends on both `orders` and `kitchenNow`; prohibit arrival detection from living only inside `refreshOrders`.

- [ ] **Step 7: Move the clock to `App`, pass it to `Orders`, and consolidate alerts.** On entering Cozinha, seed `knownOperationalOrderIdsRef` from current orders at `kitchenNow`; thereafter compare on every order collection change or exact clock tick, update the known set, and send sound/highlight only for IDs absent from `alertedOrderIdsRef`.

- [ ] **Step 8: Run focused clock, realtime, and App tests.**

Run: `node --test src/utils/kitchenQueue.test.js src/hooks/useKitchenClock.test.js src/utils/orderRealtime.test.js src/kitchenLiveRefresh.test.js src/orderTimerRefresh.test.js`

Expected: PASS; the exact timeout, periodic fallback, focus/visibility refresh, and cleanup are all covered.

- [ ] **Step 9: Commit the independently reviewable timing change.**

```bash
git add src/hooks/useKitchenClock.js src/hooks/useKitchenClock.test.js src/App.jsx src/pages/Orders.jsx src/utils/orderRealtime.js src/utils/orderRealtime.test.js src/kitchenLiveRefresh.test.js src/orderTimerRefresh.test.js
git commit -m "fix: transition scheduled kitchen orders on time"
```

### Checkpoint 1: Domain and clock review

- [ ] Review the Task 1–2 diff only: `git diff HEAD~2..HEAD -- shared src/utils src/hooks src/App.jsx src/pages/Orders.jsx`.
- [ ] Confirm one persisted active order is never assigned to two main queues and no new status write/API exists.
- [ ] Confirm exact timeout cleanup/recalculation occurs when `orders`, `active`, or component lifecycle changes.
- [ ] Confirm the minute interval is only a fallback and sound/highlight is emitted once at the same operational boundary.
- [ ] Run `git diff --check HEAD~2..HEAD` and the focused tests again before proceeding.

### Task 3: Build ticket summaries and item-note aggregation from `item.note`

**Files:**
- Create: `src/utils/kitchenTicket.js`
- Create: `src/utils/kitchenTicket.test.js`
- Create: `src/components/KitchenTicketNotes.jsx`
- Create: `src/components/KitchenTicket.jsx`
- Create: `src/components/KitchenTicket.test.js`
- Modify: `src/pages/OrdersMultiItem.test.js`

**Interfaces:**
- Consumes: a Task 1 queue entry and existing `getOrderItems(order)` / `getOrderItemDisplayName(item)` helpers.
- Produces: `buildKitchenItemSummary(order, limit = 3) -> string` such as `5 itens · Marmita G, Coca 2L, Pudim +2`.
- Produces: `getKitchenItemNotes(order) -> Array<{ key, itemLabel, note, text }>` using only non-empty `item.note`.
- Produces: `buildKitchenTimingCopy(entry, now) -> { primary, secondary }`.
- `KitchenTicket` props: `{ entry, now, disabled, highlighted, onDetails, onFinalize, onCancel }`.

- [ ] **Step 1: Write RED pure summary/note tests.**

```js
assert.equal(buildKitchenItemSummary(order, 3), '5 itens · Marmita G, Coca-Cola 2L, Pudim +2')
assert.deepEqual(getKitchenItemNotes(order), [
  { key: 'item-1', itemLabel: 'Marmita G', note: 'sem cebola', text: 'Marmita G — sem cebola' },
  { key: 'item-2', itemLabel: 'Suco 500 ml', note: 'sem gelo', text: 'Suco 500 ml — sem gelo' },
])
assert.deepEqual(getKitchenItemNotes({ items: [{ name: 'Pudim', note: '   ' }] }), [])
assert.equal(Object.hasOwn(order, 'note'), false)
```

- [ ] **Step 2: Run the pure tests and verify RED.**

Run: `node --test src/utils/kitchenTicket.test.js`

Expected: FAIL because the view-model helpers do not exist.

- [ ] **Step 3: Implement minimum summary, note, and timing view models.** Use normalized item notes without mutating the order. Timing copy must cover `Preparo em 25 min`, `Em preparo há 18 min`, `Fora do prazo há 12 min`, and `Desejado HH:mm` only when scheduled; format `HH:mm` with `FINANCE_TIME_ZONE` rather than the browser's arbitrary local timezone.

- [ ] **Step 4: Add RED component/privacy tests.** Require the number, client, attendance icon/text, item summary, notes, status chip, timing, desired time when applicable, `Exibir detalhes`, and the correct operational action. Explicitly reject `total`, `currency`, `payment`, `deliveryFee`, `address`, `phone`, a generic `order.note`, and the old expandable-items UI.

```js
assert.doesNotMatch(ticket, /order\.(?:total|paymentMethod|deliveryFee|address|phone|note)/)
assert.match(ticket, /entry\.phase === 'scheduled'/)
assert.match(ticket, /onCancel/)
assert.match(ticket, /onFinalize/)
```

- [ ] **Step 5: Implement `KitchenTicketNotes` and `KitchenTicket`.** Render complete notes in the DOM, one associated line per item, inside a `.kitchen-ticket-notes` block; enforce the visual two-line maximum in CSS later, not by deleting array data. Scheduled tickets expose details + cancel. Preparing tickets expose details + `getFinalActionLabel(order)` and no cancel button.

- [ ] **Step 6: Run RED → GREEN and existing multi-item regressions.**

Run: `node --test src/utils/kitchenTicket.test.js src/components/KitchenTicket.test.js src/pages/OrdersMultiItem.test.js`

- [ ] **Step 7: Commit the ticket units.**

```bash
git add src/utils/kitchenTicket.js src/utils/kitchenTicket.test.js src/components/KitchenTicket.jsx src/components/KitchenTicketNotes.jsx src/components/KitchenTicket.test.js src/pages/OrdersMultiItem.test.js
git commit -m "feat: add focused kitchen ticket components"
```

### Task 4: Extend internal icons and compact stat-card contracts

**Files:**
- Modify: `src/components/Icon.jsx`
- Modify: `src/components/StatCard.jsx`
- Create: `src/kitchenRedesignRegression.test.js`
- Modify: `src/App.css`

**Interfaces:**
- Produces icon names: `kitchen`, `preparation`, `clock`, `alert`, `client`, `delivery`, `pickup`, `local`, `note`, `details`, `printer`, `volume-on`, `volume-off`, `cancel`.
- `StatCard` gains optional `className = ''`; all existing props and markup remain compatible.

- [ ] **Step 1: Write a RED icon/stat contract test.** Assert every icon key is defined inside the internal map, `Icon` keeps `strokeWidth="1.8"`, rounded caps/joins, and no icon package appears in `package.json`. Assert `StatCard` merges `className` without requiring it.

- [ ] **Step 2: Run the regression test and verify RED.**

Run: `node --test src/kitchenRedesignRegression.test.js`

Expected: FAIL on missing kitchen-specific icon names and `StatCard.className`.

- [ ] **Step 3: Add only the SVG paths needed by the approved screen.** Reuse existing view box and stroke language; use `volume-off` as the muted variant and do not insert emoji icons in the new header/tickets.

- [ ] **Step 4: Add the compatible `StatCard` class merge.**

```jsx
function StatCard({ label, value, helper, icon = 'dashboard', tone = 'neutral', className = '' }) {
  const classes = ['stat-card', `tone-${tone}`, className].filter(Boolean).join(' ')
  return <article className={classes}>…</article>
}
```

- [ ] **Step 5: Run the focused test and the existing dashboard/icon regressions.**

Run: `node --test src/kitchenRedesignRegression.test.js src/dashboardCharts.test.js src/dashboardResponsive.test.js src/operationsUxRound.test.js`

- [ ] **Step 6: Commit the design-system extension.**

```bash
git add src/components/Icon.jsx src/components/StatCard.jsx src/kitchenRedesignRegression.test.js src/App.css
git commit -m "feat: extend kitchen visual primitives"
```

### Task 5: Compose the approved Cozinha page and responsive ticket identity

**Files:**
- Modify: `src/pages/Orders.jsx`
- Modify: `src/pages/OrdersScheduled.test.js`
- Modify: `src/pages/OrdersMobile.test.js`
- Modify: `src/order-operations.css`
- Modify: `src/order-operations-compact.css`
- Modify: `src/index.css`
- Modify: `src/kitchenRedesignRegression.test.js`

**Interfaces:**
- Consumes: `now` from Task 2, `buildKitchenQueueModel` from Task 1, and `KitchenTicket` from Task 3.
- Preserves existing parent callbacks and printing manager; no network access is moved into tickets.
- Produces persistent `.kitchen-queue-section` blocks for `preparing` and `scheduled`, even when empty.

- [ ] **Step 1: Write RED page-composition tests.** Require exact title/subtitle, action labels, all four compact counters, fixed queue headings/help, approved empty messages, `KitchenTicket`, and no `Aguardando janela` anywhere under `src`.

```js
for (const text of ['Cozinha', 'Acompanhe os pedidos em preparo e agendados', 'Em preparo', 'Agendados', 'Fora do prazo', 'Finalizados hoje', 'Mais antigos primeiro', 'Mais próximos primeiro']) {
  assert.match(orders, new RegExp(text))
}
assert.doesNotMatch(allSrc, /Aguardando janela/i)
assert.match(orders, /<KitchenTicket/)
```

- [ ] **Step 2: Run focused page tests and verify RED.**

Run: `node --test src/pages/OrdersScheduled.test.js src/kitchenRedesignRegression.test.js`

Expected: FAIL on old title, helper, queue composition, and legacy copy.

- [ ] **Step 3: Replace inline queue logic with the view model and two explicit sections.** The search placeholder becomes `Buscar cliente, pedido, produto ou tipo`. Remove the sort selector/expanded-items state. Keep search structures visible even when neither queue has matches.

- [ ] **Step 4: Wire exact state actions.** `onDetails` opens the shared details modal; scheduled `onCancel` opens the cancellation dialog; preparing `onFinalize` opens the existing confirmation. Preparing cancellation is not passed into the ticket.

- [ ] **Step 5: Add RED desktop/mobile CSS tests.** Assert:
  - four equal counter columns on desktop and exactly two columns at `max-width: 640px`;
  - warm dark `.kitchen-page`/`.kitchen-board` background tokens;
  - light `.kitchen-ticket` surfaces with readable local ticket text tokens;
  - three information zones on wide screens and stacked content on narrow screens;
  - `-webkit-line-clamp: 2` plus `overflow: hidden` on notes;
  - full-text actions with `min-height: var(--mobile-touch-target)`;
  - no width/min-width rule above 320 px that can force horizontal scrolling.

- [ ] **Step 6: Add centralized kitchen tokens to both theme blocks.**

```css
:root {
  --kitchen-bg: #1b1817;
  --kitchen-panel: #24201e;
  --kitchen-ticket: #fffaf7;
  --kitchen-ticket-text: #25211f;
  --kitchen-ticket-muted: #6f6661;
  --kitchen-preparing: #d97706;
  --kitchen-scheduled: #2563eb;
  --kitchen-late: #dc3545;
  --kitchen-finished: #168a55;
}
```

Use only these semantic variables in kitchen selectors. The same named variables must exist in `:root[data-theme='dark']`; do not scatter equivalent colors through component rules.

- [ ] **Step 7: Implement the desktop ticket layout.** Match the official left mockup: compact title/actions, four small counters, dark board, clear receipt-like tickets, status chips, left identity / center summary+notes / right timing, and text actions in the footer. Use subtle pseudo-element notches only when they do not reduce content width.

- [ ] **Step 8: Implement 320–480 px responsive rules.** Keep counters 2 × 2, stack ticket zones in priority order, keep desired/operational time readable, allow action buttons to form two columns or separate rows, and retain the same colors/chips/icons rather than switching to a generic mobile card.

- [ ] **Step 9: Run RED → GREEN plus all nearby layout tests.**

Run: `node --test src/pages/OrdersScheduled.test.js src/pages/OrdersMobile.test.js src/pages/OrdersMultiItem.test.js src/components/KitchenTicket.test.js src/kitchenRedesignRegression.test.js src/mobileViewportRegression.test.js src/mobileFoundation.test.js src/uiPolish.test.js`

- [ ] **Step 10: Commit the page redesign.**

```bash
git add src/pages/Orders.jsx src/pages/OrdersScheduled.test.js src/pages/OrdersMobile.test.js src/order-operations.css src/order-operations-compact.css src/index.css src/kitchenRedesignRegression.test.js
git commit -m "feat: redesign kitchen with classic tickets"
```

### Checkpoint 2: Visual hierarchy and ticket privacy review

- [ ] Start the local app with `npm run dev -- --host 127.0.0.1` using fixture/staging-safe data only.
- [ ] Compare at desktop width against the left “Ticket clássico” panel: header density, 4-card proportions, warm dark board, clear tickets, chip placement, three information zones, and text actions.
- [ ] Inspect widths 320, 360, 390, 430, and 480 px: counters remain 2 × 2, no horizontal scroll, notes clamp visually, and buttons retain full labels and 44 px targets.
- [ ] Verify tickets never show total, payment, fee, address, or phone and that notes are associated with their item.
- [ ] Verify both queues and their empty copy remain visible with zero results and during a no-match search.
- [ ] Run `git diff --check HEAD~3..HEAD` and repeat Task 3–5 focused tests.

### Task 6: Rebuild semantic timing/details and relocate preparation cancellation

**Files:**
- Create: `src/components/OrderDetailTiming.jsx`
- Modify: `src/components/OrderDetailTiming.test.js`
- Modify: `src/components/OrderDetail.jsx`
- Modify: `src/order-operations.css`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/pages/OrdersMultiItem.test.js`
- Modify: `src/pages/OrderHistory.test.js`
- Modify: `src/pages/ReceivablesDetails.test.js`

**Interfaces:**
- Produces: `buildOrderDetailTimingRows(order) -> Array<{ key, label, value }>` and `OrderDetailTiming({ order })`.
- `OrderDetail` gains optional `onRequestCancel`; history and receivables omit it, while Cozinha passes it for active orders.

- [ ] **Step 1: Write RED behavior tests for timing rows.**

```js
assert.deepEqual(buildOrderDetailTimingRows(finishedDelivery), [
  { key: 'desired', label: 'Horário desejado', value: '20:42' },
  { key: 'operational-start', label: 'Início operacional', value: '04/09/2026 às 19:52' },
  { key: 'duration', label: 'Tempo até sair para entrega', value: '18 min' },
])
assert.equal(buildOrderDetailTimingRows(finishedPickup).at(-1).label, 'Tempo até finalização')
```

- [ ] **Step 2: Run the timing test and verify RED.**

Run: `node --test src/components/OrderDetailTiming.test.js`

Expected: FAIL because rows are still concatenated inline in `OrderDetail.jsx`.

- [ ] **Step 3: Implement the pure rows and semantic `<dl>`.** Each row must render one `<div>`, `<dt>{label}</dt>`, and `<dd>{value}</dd>`; format dates in `FINANCE_TIME_ZONE` and durations with `formatElapsedDuration`.

- [ ] **Step 4: Add RED detail-structure tests.** Require ordered sections `Resumo`, `Horários`, `Itens`, `Valores`, `Impressão`; complete `item.note` text inside its item; semantic timing class names; and no visually concatenated label/value markup.

- [ ] **Step 5: Recompose `OrderDetail`.** Preserve payment/contact/value details here, move timing to `OrderDetailTiming`, keep all item notes complete, and keep the printing block last. Add `Cancelar pedido` inside details only when `onRequestCancel` is supplied.

- [ ] **Step 6: Wire preparation cancellation from details.** In `Orders.jsx`, `onRequestCancel={() => { setDetailOrder(null); setCancelOrder(detailOrder) }}` opens the existing `CancelOrderDialog`. Scheduled tickets retain direct cancel; preparing tickets do not.

- [ ] **Step 7: Add CSS for aligned `<dt>/<dd>` timing rows and responsive section cards; run RED → GREEN.**

Run: `node --test src/components/OrderDetailTiming.test.js src/pages/OrdersMultiItem.test.js src/pages/OrderHistory.test.js src/pages/ReceivablesDetails.test.js src/components/KitchenTicket.test.js`

- [ ] **Step 8: Commit the details correction.**

```bash
git add src/components/OrderDetailTiming.jsx src/components/OrderDetailTiming.test.js src/components/OrderDetail.jsx src/order-operations.css src/pages/Orders.jsx src/pages/OrdersMultiItem.test.js src/pages/OrderHistory.test.js src/pages/ReceivablesDetails.test.js
git commit -m "fix: clarify kitchen order details and timing"
```

### Task 7: Correct print success copy and lock manual/automatic job independence

**Files:**
- Modify: `src/components/PrintStatusBadge.jsx`
- Modify: `src/printing/printingUi.test.js`
- Modify: `src/components/OrderDetail.jsx`
- Modify: `worker/orderPrintingRepository.test.js`
- Modify: `worker/orderPrintingHttp.test.js`
- Modify only if a new test fails: `worker/orderPrintingRepository.js`, `worker/orderPrintingApi.js`, `src/printing/usePrintingManager.js`

**Interfaces:**
- `PrintStatusBadge({ job: { status: 'printed' } })` displays `Enviado para impressão`.
- Existing `printing.printOrder(orderId, copies)` remains the manual-job entry point.
- A manual job never updates/deletes/retries the automatic job ID or its `availableAt`.

- [ ] **Step 1: Change the expected UI label first and verify RED.**

```js
assert.match(badge, /printed:\s*'Enviado para impressão'/)
assert.doesNotMatch(badge, /printed:\s*'Impresso'/)
```

Run: `node --test src/printing/printingUi.test.js`

Expected: FAIL because the current label is `Impresso`.

- [ ] **Step 2: Make the one-line label change and verify GREEN.** Keep technical state, CSS class, and transport result named `printed`.

- [ ] **Step 3: Add the scheduled-print UI RED assertions.** Require the exact helper `Impressão programada para HH:mm`, action `Imprimir agora`, and `printing.printOrder(order.id, defaultCopies)` rather than `retryJob(printJob)` for a future automatic job.

- [ ] **Step 4: Make the minimum `OrderDetail` adjustment needed for the exact copy/action and rerun GREEN.** Ensure the generic pending helper does not contradict the scheduled helper before `availableAt`.

- [ ] **Step 5: Add repository and HTTP coexistence coverage.** This is a characterization gate for an already intended backend contract: create a future automatic job, create/claim/complete a manual job now, assert both IDs exist, assert the automatic row is still `pending` with the original `availableAt`, assert claim-next returns `null` before that time, and returns the automatic ID at the exact time.

```js
assert.notEqual(manual.id, automatic.id)
assert.equal((await loadPrintJob(db, businessA, automatic.id)).status, 'pending')
assert.equal((await loadPrintJob(db, businessA, automatic.id)).availableAt, future.toISOString())
assert.equal(await claimNextAutomaticPrintJob(db, businessA, 'primary', before), null)
assert.equal((await claimNextAutomaticPrintJob(db, businessA, 'primary', future)).id, automatic.id)
```

If this characterization test is already GREEN on first run, do not manufacture a production-code change; retain the regression test. If it is RED, change only the repository/API statement responsible, then rerun the exact test to GREEN.

- [ ] **Step 6: Run all print-job and UI focused tests.**

Run: `node --test src/printing/printingUi.test.js src/api/printingClient.test.js worker/orderPrintingRepository.test.js worker/orderPrintingHttp.test.js worker/orderAutomaticPrintJob.test.js`

- [ ] **Step 7: Commit copy and independence coverage.**

```bash
git add src/components/PrintStatusBadge.jsx src/components/OrderDetail.jsx src/printing/printingUi.test.js worker/orderPrintingRepository.test.js worker/orderPrintingHttp.test.js worker/orderPrintingRepository.js worker/orderPrintingApi.js src/printing/usePrintingManager.js
git commit -m "fix: clarify and preserve scheduled printing"
```

Before staging, use `git status --short` and omit unchanged optional production files from the actual `git add` command.

### Task 8: Integrate printing settings with light/dark theme tokens

**Files:**
- Modify: `src/components/PrintingSettings.jsx`
- Modify: `src/components/PrintingSettings.test.js`
- Modify: `src/printing/printing.css`
- Modify: `src/theme.test.js`

**Interfaces:**
- Keeps all existing `printing` methods and settings payloads unchanged.
- Produces stable classes for status, info cards, action rows, toggle, copy options, compatibility, focus, and disabled states.

- [ ] **Step 1: Write RED theme/style tests.** Assert printing settings use only `var(--surface*)`, `var(--text*)`, `var(--border*)`, and semantic success/info/danger tokens; require explicit `:focus-visible`, `:hover`, `:disabled`, and `[data-theme='dark']` coverage where global tokens alone are insufficient. Reject `var(--name, #hex)` light-only fallbacks in settings selectors.

- [ ] **Step 2: Run the settings/theme tests and verify RED.**

Run: `node --test src/components/PrintingSettings.test.js src/theme.test.js`

Expected: FAIL on current light fallbacks and incomplete state coverage.

- [ ] **Step 3: Add semantic wrapper/field classes in JSX without changing behavior.** Keep native checkbox/radios, labels, saved values 1/2, primary confirmation, support messaging, and manager calls intact.

- [ ] **Step 4: Rewrite settings CSS with existing semantic tokens.** Include readable card/input/radio surfaces in light and dark, `accent-color: var(--primary)`, visible focus ring, disabled opacity/cursor without losing label contrast, wrapped station/error text, and full-width mobile actions below 480 px.

- [ ] **Step 5: Run RED → GREEN and printing manager regressions.**

Run: `node --test src/components/PrintingSettings.test.js src/theme.test.js src/printing/printingManagerRegression.test.js src/systemSelect.test.js`

- [ ] **Step 6: Commit the isolated theme correction.**

```bash
git add src/components/PrintingSettings.jsx src/components/PrintingSettings.test.js src/printing/printing.css src/theme.test.js
git commit -m "fix: integrate printing settings with dark theme"
```

### Checkpoint 3: Details and printing review

- [ ] Review Task 6–8 diffs and confirm detail order is Resumo → Horários → Itens → Valores → Impressão.
- [ ] Verify all item notes remain complete in details and no order-level note field appears in migrations, worker validation, client payloads, or React state: `rg -n "order\.note|orderNote|generalNote" src shared worker migrations` should return no newly introduced contract.
- [ ] Verify `rg -n "Aguardando janela|printed:\s*'Impresso'" src` returns no matches.
- [ ] Verify technical/log/test references to status `printed` remain unchanged where they are not user-facing.
- [ ] Inspect Printing Settings in both `data-theme="light"` and `data-theme="dark"`, including focus, hover, disabled, long station name/error, and 320 px layout.
- [ ] Run `git diff --check HEAD~3..HEAD` and Task 6–8 focused tests.

### Task 9: Add integrated regressions and perform fidelity/accessibility QA

**Files:**
- Modify: `src/kitchenRedesignRegression.test.js`
- Modify: `src/pages/OrdersScheduled.test.js`
- Modify: `src/pages/OrdersMobile.test.js`
- Modify: `src/mobileViewportRegression.test.js`
- Modify: `src/mobileUxIntegration.test.js`
- Modify only when a failing regression identifies the responsible code: files from Tasks 1–8.

**Interfaces:**
- No new runtime API; this task locks the approved composition and checks interactions across the extracted units.

- [ ] **Step 1: Add one RED integrated fixture test.** Model immediate, scheduled-before-window, scheduled-at-window, overdue, final-today, cancelled, and long-content orders; assert queue exclusivity, fixed order, counts, status/timing copy, item notes, and state-specific action contracts.

- [ ] **Step 2: Add RED copy/privacy regressions.** Scan user-facing Cozinha source for `Agendado para preparo`, `Enviado para impressão`, approved empty messages, and absence of `Aguardando janela`; assert ticket source has no financial/contact access while detail source still has those fields.

- [ ] **Step 3: Add RED responsive/accessibility regressions.** Require semantic headings, queue regions with accessible names, status text in addition to color, buttons with full labels, visible focus selectors, reduced-motion behavior, 2 × 2 mobile stats, note line clamp, wrap/overflow protection, and 44 px mobile targets.

- [ ] **Step 4: Run the integrated set and make only minimal fixes to GREEN.**

Run: `node --test src/kitchenRedesignRegression.test.js src/pages/OrdersScheduled.test.js src/pages/OrdersMobile.test.js src/mobileViewportRegression.test.js src/mobileUxIntegration.test.js`

- [ ] **Step 5: Perform manual visual QA with the official mockup.** Capture/inspect desktop at 1440 × 900 and mobile at 390 × 844 for populated queues, each empty queue, no-match search, long customer/product/note text, preparing/late/scheduled chips, details, and printing settings in both themes.

- [ ] **Step 6: Perform manual temporal QA with controlled fixtures.** Create a staging-safe scheduled order whose `operationalStartAt` is a few minutes ahead, leave Cozinha open without clicking/changing tabs, and record that the ticket moves at the boundary, counters update, and sound/highlight occur once. Repeat with sound disabled and after focus recovery.

- [ ] **Step 7: Perform manual printing-state QA without claiming physical paper success.** Verify future automatic job message/action, manual job creation, automatic job preservation, disconnected-printer error, and `Enviado para impressão` only after the technical completion response.

- [ ] **Step 8: Commit regression coverage/fixes.**

```bash
git add src/kitchenRedesignRegression.test.js src/pages/OrdersScheduled.test.js src/pages/OrdersMobile.test.js src/mobileViewportRegression.test.js src/mobileUxIntegration.test.js
git commit -m "test: cover kitchen redesign homologation flows"
```

Add any minimal runtime files changed by Step 4 explicitly after reviewing `git status --short`.

### Task 10: Full validation, branch review, and staging-only homologation handoff

**Files:** No planned source changes. Any failure returns to the task that owns the behavior for a fresh focused RED/GREEN correction and separate commit.

**Interfaces:**
- Consumes the completed branch.
- Produces a verified staging deployment and a production-blocked homologation handoff.

- [ ] **Step 1: Confirm branch/worktree safety.**

```bash
git branch --show-current
git status --short --branch
git merge-base --is-ancestor origin/feature/scheduled-orders-operational-timing HEAD
```

Expected: the isolated implementation branch is based on the feature branch; no checkout or write occurred on `master` or the original dirty worktree.

- [ ] **Step 2: Run the complete automated test suite.**

Run: `npm test`

Expected: PASS, 0 failures.

- [ ] **Step 3: Run lint.**

Run: `npm run lint`

Expected: PASS, 0 errors.

- [ ] **Step 4: Build the production-format bundle locally.**

Run: `npm run build`

Expected: PASS with `dist/` generated locally and no unresolved imports.

- [ ] **Step 5: Validate whitespace and patch integrity.**

Run: `git diff --check origin/feature/scheduled-orders-operational-timing...HEAD`

Expected: no output and exit code 0.

- [ ] **Step 6: Run both read-only Cloudflare bundle dry-runs.**

Run: `npx --yes wrangler@4.128.0 deploy --dry-run`

Run: `npx --yes wrangler@4.128.0 deploy --dry-run --env staging`

Expected: both PASS without remote writes. These commands validate production/staging configurations but deploy neither environment.

- [ ] **Step 7: Run the existing local D1 compatibility gate.**

Run: `npm run d1:migrate:local`

Expected: PASS. No new migration is expected for this redesign.

- [ ] **Step 8: Review the complete branch diff and commit series.**

```bash
git diff --stat origin/feature/scheduled-orders-operational-timing...HEAD
git diff origin/feature/scheduled-orders-operational-timing...HEAD
git log --oneline origin/feature/scheduled-orders-operational-timing..HEAD
```

Confirm scope is limited to Cozinha, shared details/printing presentation, focused tests, and any proven print-job regression fix.

- [ ] **Step 9: Push only to the feature/staging branch.** Fetch first; if the remote advanced, stop and reconcile without reset/restore/clean/stash. After confirming a fast-forward-safe base, push the reviewed HEAD to `origin/feature/scheduled-orders-operational-timing`.

- [ ] **Step 10: Trigger and watch the official staging workflow for the reviewed feature SHA.**

```bash
gh workflow run deploy-staging.yml --ref feature/scheduled-orders-operational-timing
STAGING_RUN_ID="$(gh run list --workflow deploy-staging.yml --branch feature/scheduled-orders-operational-timing --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch "$STAGING_RUN_ID" --exit-status
```

Do not run `deploy:production`, the production workflow, or any remote production migration command.

- [ ] **Step 11: Execute staging homologation at `https://sistema-para-delivery-staging.vzaponi.workers.dev`.** Repeat the desktop/mobile, exact-boundary, details, dark printing settings, status-copy, and manual-vs-auto print-job checks from Task 9 using only fake staging data.

- [ ] **Step 12: Report the staging SHA, automated gate results, screenshots/observations, and any hardware limitations.** State explicitly: production remains blocked pending new manual homologation and explicit user authorization.

- [ ] **Step 13: Stop.** Do not merge to `master` and do not start a production release.

## Final Review Checklist

- [ ] Official “Opção A — Ticket clássico” visual hierarchy is recognizable on desktop and mobile.
- [ ] Header is compact and all four compact counters are 4-across desktop / 2 × 2 mobile.
- [ ] Preparing is oldest operational start first; scheduled is nearest desired time first.
- [ ] Every active order belongs to exactly one main queue; late remains an additional red signal.
- [ ] Exact next `operationalStartAt` timeout moves the ticket without refresh, click, or tab change; fallback timers/listeners clean up.
- [ ] Arrival sound/highlight fires once at the same boundary and is not replayed retroactively on initial open.
- [ ] `Aguardando janela` is absent; `Agendado para preparo` is used consistently.
- [ ] Tickets show only operational data and state-appropriate actions; preparing cancellation lives in details.
- [ ] Notes come only from `item.note`, preserve item association, clamp to two visual lines on tickets, and remain complete in details.
- [ ] Timing detail pairs are semantic, aligned, business-timezone formatted, and use the correct completion label by attendance type.
- [ ] Printing settings are legible and interactive in light/dark and at 320–480 px.
- [ ] `printed` displays as `Enviado para impressão` without changing the technical state.
- [ ] Future automatic print message/action is exact; manual printing creates an independent job and preserves future automatic eligibility.
- [ ] Existing order, cancellation, history, receivables, printing, theme, mobile, and reduced-motion behavior remains green.
- [ ] `npm test`, `npm run lint`, `npm run build`, `git diff --check`, both Wrangler dry-runs, and local D1 migration validation pass.
- [ ] Only staging is deployed and homologated; `master` and production remain untouched and blocked.
