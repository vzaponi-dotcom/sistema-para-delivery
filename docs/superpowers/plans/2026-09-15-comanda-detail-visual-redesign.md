# Comanda Detail Visual Redesign Implementation Plan

> **For ChatGPT:** Execute inline with TDD. Keep business logic unchanged.

**Goal:** Rebuild only the presentation of the Comanda detail panel to match the approved mobile mockup, preserve the desktop split-pane beside the table list, and support both light and dark themes.

**Architecture:** Reuse the existing `ComandaDetail` component and all current handlers/capability guards. Move the visible Comanda heading into the redesigned hero so the existing mobile focus handoff can target the same semantic `h2`. Keep the `Comandas` workspace/list/selection logic intact. Use existing design tokens and `Button`/`Icon` primitives; scope CSS to the Comanda detail so other screens do not change.

**Spec:** Final mockup approved in the 2026-09-15 project conversation; no separate repository spec. Presentation-only scope.

---

## Task 1 — Lock the approved presentation contract (RED)

**Files:**
- Modify: `src/components/ComandaDetail.test.js`

Add assertions that the rendered detail exposes the approved semantic groups/classes without weakening existing behavior coverage:

```js
const hero = r.root.findByProps({ className: 'comanda-detail-hero' })
assert.match(nodeText(hero), /COMANDA.*42.*Mesa 7.*Ocupada.*Abertura/)
assert.ok(r.root.findByProps({ className: 'comanda-detail-order-summary' }))
assert.ok(r.root.findByProps({ className: 'comanda-detail-total' }))
assert.equal(buttonNamed(r.root, 'Adicionar pedido').props.className.includes('comanda-action-primary'), true)
assert.equal(buttonNamed(r.root, 'Registrar pagamento').props.className.includes('comanda-action-payment'), true)
assert.equal(buttonNamed(r.root, 'Ver ticket').props.className.includes('comanda-action-secondary'), true)
```

Also keep the existing action callback assertions so the visual redesign cannot change behavior.

**Verify RED:** run the focused Comanda detail test / observe CI failure caused by missing new presentation classes, not by unrelated behavior.

---

## Task 2 — Implement the approved Comanda markup while preserving behavior

**Files:**
- Modify: `src/components/ComandaDetail.jsx`
- Modify: `src/pages/Comandas.jsx`
- Modify only if needed: `src/components/Icon.jsx`

### `ComandaDetail.jsx`

Import `Icon` and keep all existing `closed`, `blocked`, `payable`, capability checks and callback guards exactly as they are.

Render these groups:

1. `comanda-detail-hero`
   - eyebrow `COMANDA`
   - semantic `h2` `Comanda {number}` / visually emphasize number
   - table chip with `Icon name="table"`
   - status chip with dot, `Ocupada` / `Encerrada`
   - opening timestamp with `Icon name="clock"`

2. `comanda-detail-order-summary`
   - `Icon name="meal"`
   - `{orderCount} pedido(s) • {itemCount} item(ns)`

3. `comanda-detail-items-section`
   - heading `Resumo do pedido` with `Icon name="receipt"`
   - item count helper
   - each item row split into quantity, description, and subtotal
   - preserve presentation and note text
   - preserve unit price and line total exactly

4. `comanda-detail-total`
   - `Icon name="wallet"`
   - `Total a pagar`
   - helper counts
   - canonical total

5. `comanda-detail-actions`
   - full-width red `Adicionar pedido`, `icon="plus"`, class `comanda-action-primary`
   - full-width outlined `Registrar pagamento`, class `comanda-action-payment`, using an existing finance/payment icon
   - secondary grid in this exact order: Transferir (when capability exists), Ver ticket, Imprimir comanda; class `comanda-action-secondary`
   - preserve disabled states and handlers exactly

### `Comandas.jsx`

Remove the old standalone detail heading and pass `detailHeadingRef` into `ComandaDetail` so the hero `h2` remains the mobile focus target. Keep:
- the table list markup and behavior
- `comandas-workspace` split pane
- mobile show/hide logic
- back action semantics
- data refresh/payment/printing/transfer flows

If a new icon is genuinely needed, add only a small reusable icon to `Icon.jsx`; do not introduce an icon dependency.

**Verify GREEN:** focused `ComandaDetail.test.js` and relevant `Comandas.test.js` cases pass.

---

## Task 3 — Match the mockup responsively in light and dark themes

**Files:**
- Modify: `src/comandas.css`
- Test: `src/components/ComandaDetail.test.js` and existing responsive/integration tests

Use only existing theme variables such as:
- `var(--surface)` / `var(--surface-soft)` / `var(--surface-strong)`
- `var(--text)` / `var(--text-soft)` / `var(--muted)`
- `var(--border)` / `var(--border-strong)`
- `var(--primary)` / `var(--primary-soft)`

Required layout:
- desktop: leave `comandas-workspace` two-column split intact; redesign only the right detail panel; layout must adapt to the narrower side panel
- mobile: 360–430px friendly, no horizontal overflow, product names wrap, subtotals remain readable
- action hierarchy exactly as approved: primary full-width, payment full-width outline, three secondary actions in one row when space permits; compact/wrap safely on very narrow widths without losing labels
- adequate bottom spacing above the app bottom navigation
- visible focus states and 44px+ touch targets

Do not hardcode a dark-only palette; theme tokens must produce a coherent light version automatically.

---

## Task 4 — Regression gates and staging integration

**Files:** no production changes expected here unless a directly related regression is found.

Run/confirm:
1. focused Comanda tests
2. complete test suite
3. lint
4. build
5. existing Worker/staging validation gates

Confirm no behavioral regressions in:
- add order
- register payment
- transfer
- ticket preview
- print
- capability/readonly/closed states
- mobile back/focus restoration
- desktop split pane

Keep implementation on `feature/comanda-detail-visual-polish` while validating. After the feature branch is green, integrate only this branch into the existing staging branch `feature/spec-b-settings-policies` (never `master`) so the existing automatic staging deployment runs. Confirm the final staging run and login verification on the integrated SHA.

**Production deployment is explicitly out of scope.**
