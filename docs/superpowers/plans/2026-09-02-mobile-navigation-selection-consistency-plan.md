# Mobile Navigation and Selection Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver mobile bottom navigation with deliberate swipe navigation, keep order elapsed time current after app resume, and replace every application-facing native JSX `<select>` with one consistent system selector.

**Architecture:** `App.jsx` remains the owner of navigation and business state. Focused UI units handle a reusable bottom sheet, mobile navigation, and fixed-option selection; a pure utility handles swipe rules. Desktop keeps the existing sidebar. Mobile uses a fixed bottom bar plus `Mais`. `SystemSelect` uses an anchored custom dropdown on desktop and the shared bottom sheet on mobile, so business values and handlers are not duplicated.

**Tech Stack:** React 19, plain CSS, Node.js built-in test runner, Vite 8.2.2, oxlint, Cloudflare Wrangler 4.128.0. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-02-mobile-navigation-selection-consistency-design.md`

## Global Constraints

- Mobile breakpoint is exactly `max-width: 820px`.
- Main mobile sequence is exactly `dashboard → orders → clients → products → receivables → finance`.
- Bottom navigation has exactly Dashboard, Pedidos, Clientes, Produtos, Mais.
- `receivables` and `finance` are reached through `Mais`; `Mais` is active while either is active.
- Swipe is mobile-only, moves one section at a time, never wraps, and is disabled on `new-order`.
- Swipe ignores interactive controls, dialogs/listboxes, explicitly horizontal elements, and overlay backdrops/sheets.
- Orders keep a 60-second local clock cadence and refresh immediately when document visibility returns to `visible` and on window focus.
- `SystemSelect` uses one value/options/onChange contract everywhere.
- Searchable New Order client combobox, native date input, and theme segmented control remain specialized controls.
- Target after migration: zero application-facing JSX `<select>` elements.
- No backend, D1, API, auth, payment, pricing, or order workflow semantic changes.
- No new third-party dependencies.

---

### Task 1: Pure swipe navigation rules

**Files:**
- Create: `src/utils/mobileNavigation.js`
- Create: `src/utils/mobileNavigation.test.js`

**Interfaces:**
- Produces `MOBILE_SECTION_IDS`.
- Produces `getAdjacentMobileSection(activeTab, direction)`.
- Produces `getSwipeDirection({ deltaX, deltaY, threshold })`.
- Produces `shouldIgnoreNavigationSwipe(target)`.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/mobileNavigation.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MOBILE_SECTION_IDS,
  getAdjacentMobileSection,
  getSwipeDirection,
  shouldIgnoreNavigationSwipe,
} from './mobileNavigation.js'

test('mobile sections keep the approved order', () => {
  assert.deepEqual(MOBILE_SECTION_IDS, [
    'dashboard', 'orders', 'clients', 'products', 'receivables', 'finance',
  ])
})

test('adjacent navigation moves one section and never wraps', () => {
  assert.equal(getAdjacentMobileSection('dashboard', 'previous'), 'dashboard')
  assert.equal(getAdjacentMobileSection('dashboard', 'next'), 'orders')
  assert.equal(getAdjacentMobileSection('products', 'next'), 'receivables')
  assert.equal(getAdjacentMobileSection('finance', 'next'), 'finance')
})

test('swipe requires dominant horizontal travel above threshold', () => {
  assert.equal(getSwipeDirection({ deltaX: -80, deltaY: 12, threshold: 56 }), 'next')
  assert.equal(getSwipeDirection({ deltaX: 80, deltaY: 12, threshold: 56 }), 'previous')
  assert.equal(getSwipeDirection({ deltaX: -40, deltaY: 4, threshold: 56 }), null)
  assert.equal(getSwipeDirection({ deltaX: -80, deltaY: 90, threshold: 56 }), null)
})

test('swipe ignores controls, overlays and horizontal interactions', () => {
  const makeTarget = ({ tagName = 'DIV', selectorHit = '' } = {}) => ({
    tagName,
    closest: (selector) => selector.includes(selectorHit) && selectorHit ? {} : null,
  })

  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ tagName: 'INPUT' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ tagName: 'BUTTON' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ selectorHit: '[role="dialog"]' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ selectorHit: '[data-navigation-swipe-block]' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget()), false)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/utils/mobileNavigation.test.js
```

Expected: FAIL because `mobileNavigation.js` does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/utils/mobileNavigation.js`:

```js
export const MOBILE_SECTION_IDS = Object.freeze([
  'dashboard',
  'orders',
  'clients',
  'products',
  'receivables',
  'finance',
])

export const getAdjacentMobileSection = (activeTab, direction) => {
  const currentIndex = MOBILE_SECTION_IDS.indexOf(activeTab)
  if (currentIndex < 0) return activeTab
  const offset = direction === 'next' ? 1 : direction === 'previous' ? -1 : 0
  const nextIndex = Math.min(MOBILE_SECTION_IDS.length - 1, Math.max(0, currentIndex + offset))
  return MOBILE_SECTION_IDS[nextIndex]
}

export const getSwipeDirection = ({ deltaX, deltaY, threshold = 56 }) => {
  if (Math.abs(deltaX) < threshold) return null
  if (Math.abs(deltaX) <= Math.abs(deltaY)) return null
  return deltaX < 0 ? 'next' : 'previous'
}

export const shouldIgnoreNavigationSwipe = (target) => {
  if (!target) return false
  const tagName = String(target.tagName || '').toLowerCase()
  if (['input', 'textarea', 'button', 'a', 'select'].includes(tagName)) return true
  if (typeof target.closest !== 'function') return false
  return Boolean(target.closest(
    '[role="dialog"], [role="listbox"], [data-horizontal-interaction], [data-navigation-swipe-block]',
  ))
}
```

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/utils/mobileNavigation.test.js
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/mobileNavigation.js src/utils/mobileNavigation.test.js
git commit -m "feat: add mobile swipe navigation rules"
```

---

### Task 2: Reusable accessible bottom sheet

**Files:**
- Create: `src/components/BottomSheet.jsx`
- Create: `src/bottom-sheet.css`
- Create: `src/bottomSheet.test.js`
- Modify: `src/components/Modal.jsx`

**Interfaces:**
- Produces `BottomSheet({ open, title, onClose, children })`.
- The sheet owns backdrop dismissal, Escape dismissal, focus entry, Tab focus trapping, focus restoration, dialog semantics, and `data-navigation-swipe-block`.
- `Modal.jsx` gains `data-navigation-swipe-block="true"` on its backdrop so existing modals cannot start a page swipe.

- [ ] **Step 1: Write failing source-contract tests**

Create `src/bottomSheet.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('BottomSheet is an accessible dismissible focus-trapped dialog', async () => {
  const source = await read('./components/BottomSheet.jsx')
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /Escape/)
  assert.match(source, /event\.key === 'Tab'/)
  assert.match(source, /focusable/)
  assert.match(source, /previousFocus/)
  assert.match(source, /data-navigation-swipe-block/)
})

test('existing Modal backdrop blocks navigation swipe', async () => {
  const source = await read('./components/Modal.jsx')
  assert.match(source, /modal-backdrop[^>]*data-navigation-swipe-block/s)
})

test('bottom sheet respects safe area and touch target sizes', async () => {
  const css = await read('./bottom-sheet.css')
  assert.match(css, /safe-area-inset-bottom/)
  assert.match(css, /min-height:\s*44px/)
  assert.match(css, /overscroll-behavior:\s*contain/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/bottomSheet.test.js
```

Expected: FAIL because `BottomSheet.jsx` and `bottom-sheet.css` do not exist.

- [ ] **Step 3: Implement the bottom sheet and focus trap**

Create `src/components/BottomSheet.jsx`:

```jsx
import { useEffect, useRef } from 'react'
import '../bottom-sheet.css'
import Icon from './Icon'

const focusable = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function BottomSheet({ open, title, onClose, children }) {
  const sheetRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    previousFocus.current = document.activeElement
    const sheet = sheetRef.current
    const items = () => Array.from(sheet?.querySelectorAll(focusable) || [])
    items()[0]?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const controls = items()
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="bottom-sheet-backdrop" data-navigation-swipe-block="true" onMouseDown={onClose}>
      <section
        ref={sheetRef}
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-navigation-swipe-block="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="bottom-sheet-header">
          <strong>{title}</strong>
          <button type="button" className="icon-button icon-button-neutral" aria-label="Fechar" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </section>
    </div>
  )
}

export default BottomSheet
```

- [ ] **Step 4: Add sheet CSS and mark existing Modal backdrop**

Create `src/bottom-sheet.css`:

```css
.bottom-sheet-backdrop { display: none; }

@media (max-width: 820px) {
  .bottom-sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: flex-end;
    background: rgba(0, 0, 0, 0.48);
  }

  .bottom-sheet {
    width: 100%;
    max-height: min(78vh, 620px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
    border-radius: 22px 22px 0 0;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-lg);
  }

  .bottom-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .bottom-sheet-header button { min-height: 44px; min-width: 44px; }
}
```

In `src/components/Modal.jsx`, change the backdrop opening tag to:

```jsx
<div className="modal-backdrop" data-navigation-swipe-block="true" onMouseDown={onClose}>
```

- [ ] **Step 5: Verify GREEN**

```bash
npm test -- src/bottomSheet.test.js src/uiPolish.test.js src/clientDuplicateUi.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/BottomSheet.jsx src/components/Modal.jsx src/bottom-sheet.css src/bottomSheet.test.js
git commit -m "feat: add accessible mobile bottom sheet"
```

---

### Task 3: Mobile bottom navigation and `Mais`

**Files:**
- Create: `src/components/MobileNavigation.jsx`
- Create: `src/mobile-navigation.css`
- Create: `src/mobileNavigation.test.js`
- Modify: `src/components/AppShell.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/components/Icon.jsx`
- Modify: `src/theme-controls.css`
- Modify: `src/App.css`
- Modify: `src/operationsUxRound.test.js`

**Interfaces:**
- Consumes `BottomSheet` from Task 2.
- Produces `MobileNavigation({ activeTab, onNavigate, onLogout, logoutDisabled })`.
- Reuses `useTheme()` for persisted theme preference.

- [ ] **Step 1: Write failing tests**

Create `src/mobileNavigation.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile navigation exposes four direct destinations plus Mais', async () => {
  const source = await read('./components/MobileNavigation.jsx')
  for (const label of ['Dashboard', 'Pedidos', 'Clientes', 'Produtos', 'Mais']) assert.match(source, new RegExp(label))
  assert.match(source, /aria-current=/)
  assert.match(source, /moreActive/)
})

test('Mais exposes secondary sections theme and logout in BottomSheet', async () => {
  const source = await read('./components/MobileNavigation.jsx')
  assert.match(source, /BottomSheet/)
  assert.match(source, /A Receber/)
  assert.match(source, /Financeiro/)
  assert.match(source, /Claro/)
  assert.match(source, /Escuro/)
  assert.match(source, /Automático/)
  assert.match(source, /Sair do sistema/)
})

test('mobile bar is fixed and safe-area aware while content is offset', async () => {
  const css = await read('./mobile-navigation.css')
  assert.match(css, /position:\s*fixed/)
  assert.match(css, /safe-area-inset-bottom/)
  assert.match(css, /grid-template-columns:\s*repeat\(5/)
  assert.match(css, /min-height:\s*44px/)
})

test('temporary mobile logout and horizontal sidebar scrolling are gone', async () => {
  const sidebar = await read('./components/Sidebar.jsx')
  const themeCss = await read('./theme-controls.css')
  assert.doesNotMatch(sidebar, /sidebar-mobile-logout/)
  assert.doesNotMatch(themeCss, /sidebar-mobile-logout/)
  assert.doesNotMatch(themeCss, /sidebar-nav[\s\S]*overflow-x:\s*auto/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/mobileNavigation.test.js
```

Expected: FAIL because the new component/CSS do not exist.

- [ ] **Step 3: Implement `MobileNavigation`**

Create `src/components/MobileNavigation.jsx` with direct items:

```js
const directItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'orders', label: 'Pedidos', icon: 'orders' },
  { id: 'clients', label: 'Clientes', icon: 'clients' },
  { id: 'products', label: 'Produtos', icon: 'products' },
]
```

Use local `moreOpen`, `useTheme()`, and:

```jsx
const moreActive = activeTab === 'receivables' || activeTab === 'finance'
const navigate = (id) => { onNavigate(id); setMoreOpen(false) }
```

Render a mobile-only `<nav aria-label="Navegação principal">` with the four mapped buttons plus a `Mais` button using `aria-expanded` and `aria-haspopup="dialog"`. Render:

```jsx
<BottomSheet open={moreOpen} title="Mais opções" onClose={() => setMoreOpen(false)}>
  <button type="button" className="mobile-more-action" onClick={() => navigate('receivables')}>
    <Icon name="wallet" size={20} /><span>A Receber</span>
  </button>
  <button type="button" className="mobile-more-action" onClick={() => navigate('finance')}>
    <Icon name="finance" size={20} /><span>Financeiro</span>
  </button>
  <div className="mobile-more-theme">
    <span>Tema</span>
    <div className="theme-segmented-control" role="group" aria-label="Tema do sistema">
      {themeOptions.map((option) => (
        <button key={option.value} type="button" className={themePreference === option.value ? 'theme-option active' : 'theme-option'} aria-pressed={themePreference === option.value} onClick={() => setThemePreference(option.value)}>
          <Icon name={option.icon} size={16} />{option.label}
        </button>
      ))}
    </div>
  </div>
  {onLogout && <button type="button" className="mobile-more-logout" onClick={onLogout} disabled={logoutDisabled}>Sair do sistema</button>}
</BottomSheet>
```

Define `themeOptions` with the same `light/dark/system` values and labels already used by `Sidebar.jsx`. Add a `menu` icon in `src/components/Icon.jsx`.

- [ ] **Step 4: Integrate into `AppShell` and remove old mobile workaround**

`AppShell.jsx` keeps the same public props and renders `MobileNavigation` after `<main>`. Remove the `sidebar-mobile-logout` block from `Sidebar.jsx`, its CSS from `theme-controls.css`, and the mobile horizontal-scroll `.sidebar-nav` override.

- [ ] **Step 5: Add `mobile-navigation.css`**

Required core rules:

```css
.mobile-bottom-nav { display: none; }

@media (max-width: 820px) {
  .mobile-bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 60;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .mobile-nav-item {
    min-width: 0;
    min-height: 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
  }
  .mobile-nav-item span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mobile-nav-item.active { color: var(--primary); background: var(--primary-soft); }
  .mobile-more-action, .mobile-more-logout { width: 100%; min-height: 48px; }
  .app-content { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
  .dashboard-new-order-fab { bottom: calc(82px + env(safe-area-inset-bottom)); }
}
```

Use existing theme variables for borders, text and surfaces.

- [ ] **Step 6: Update old responsive regression and run focused tests**

Change the last test in `src/operationsUxRound.test.js` so it no longer expects `sidebar-mobile-logout` or horizontal `.sidebar-nav` overflow. It should assert `MobileNavigation` exists and the old workaround does not.

Run:

```bash
npm test -- src/mobileNavigation.test.js src/operationsUxRound.test.js src/dashboardFloatingAction.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/MobileNavigation.jsx src/components/AppShell.jsx src/components/Sidebar.jsx src/components/Icon.jsx src/mobile-navigation.css src/theme-controls.css src/App.css src/mobileNavigation.test.js src/operationsUxRound.test.js
git commit -m "feat: add mobile bottom navigation"
```

---

### Task 4: Mobile-only swipe integration

**Files:**
- Modify: `src/components/AppShell.jsx`
- Create: `src/mobileSwipeNavigation.test.js`

**Interfaces:**
- Consumes all Task 1 helpers.
- Uses existing `onNavigate` only.

- [ ] **Step 1: Write failing integration-source test**

Create `src/mobileSwipeNavigation.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('AppShell wires mobile-only deliberate swipes to adjacent sections', async () => {
  const source = await read('./components/AppShell.jsx')
  assert.match(source, /getAdjacentMobileSection/)
  assert.match(source, /getSwipeDirection/)
  assert.match(source, /shouldIgnoreNavigationSwipe/)
  assert.match(source, /matchMedia\('\(max-width: 820px\)'\)/)
  assert.match(source, /activeTab === 'new-order'/)
  assert.match(source, /onTouchStart=/)
  assert.match(source, /onTouchEnd=/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/mobileSwipeNavigation.test.js
```

Expected: FAIL.

- [ ] **Step 3: Add touch handling to `AppShell.jsx`**

Import `useRef` and Task 1 helpers. Use:

```jsx
const touchStart = useRef(null)
const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches

const handleTouchStart = (event) => {
  if (!isMobileViewport() || activeTab === 'new-order' || shouldIgnoreNavigationSwipe(event.target)) {
    touchStart.current = null
    return
  }
  const touch = event.touches[0]
  touchStart.current = { x: touch.clientX, y: touch.clientY }
}

const handleTouchEnd = (event) => {
  if (!touchStart.current || !isMobileViewport() || activeTab === 'new-order') return
  const touch = event.changedTouches[0]
  const direction = getSwipeDirection({
    deltaX: touch.clientX - touchStart.current.x,
    deltaY: touch.clientY - touchStart.current.y,
  })
  touchStart.current = null
  if (!direction) return
  const destination = getAdjacentMobileSection(activeTab, direction)
  if (destination !== activeTab) onNavigate(destination)
}
```

Attach both handlers to `.app-main`. Do not call `preventDefault`; vertical scrolling stays native.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/utils/mobileNavigation.test.js src/mobileSwipeNavigation.test.js src/bottomSheet.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppShell.jsx src/mobileSwipeNavigation.test.js
git commit -m "feat: add mobile swipe section navigation"
```

---

### Task 5: Resume-aware live order timer

**Files:**
- Modify: `src/pages/Orders.jsx`
- Create: `src/orderTimerRefresh.test.js`

**Interfaces:**
- Keeps existing `now` state and 60-second interval.
- Adds only local clock refresh listeners; no network polling.

- [ ] **Step 1: Write failing test**

Create `src/orderTimerRefresh.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Orders refreshes every minute and immediately after resume', async () => {
  const source = await read('./pages/Orders.jsx')
  assert.match(source, /setInterval\([^)]*60_000/s)
  assert.match(source, /visibilitychange/)
  assert.match(source, /document\.visibilityState === 'visible'/)
  assert.match(source, /window\.addEventListener\('focus'/)
  assert.match(source, /window\.removeEventListener\('focus'/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/orderTimerRefresh.test.js
```

Expected: FAIL on missing visibility/focus handling.

- [ ] **Step 3: Replace interval-only effect**

Use exactly:

```jsx
useEffect(() => {
  const refreshNow = () => setNow(new Date())
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') refreshNow()
  }

  const timer = window.setInterval(refreshNow, 60_000)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', refreshNow)

  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', refreshNow)
  }
}, [])
```

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/orderTimerRefresh.test.js src/operationsUxRound.test.js src/utils/orderWorkflow.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Orders.jsx src/orderTimerRefresh.test.js
git commit -m "fix: refresh order timer after app resume"
```

---

### Task 6: Reusable `SystemSelect`

**Files:**
- Create: `src/components/SystemSelect.jsx`
- Create: `src/system-select.css`
- Create: `src/systemSelect.test.js`
- Modify: `src/components/Icon.jsx`

**Interfaces:**
- Produces `SystemSelect({ value, options, onChange, disabled = false, label, id, placeholder = 'Selecione' })`.
- `options` is `{ value, label }[]`.
- `onChange(nextValue)` receives only the selected value.
- Consumes `BottomSheet` on mobile.

- [ ] **Step 1: Write failing component contract tests**

Create `src/systemSelect.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('SystemSelect exposes custom combobox/listbox semantics', async () => {
  const source = await read('./components/SystemSelect.jsx')
  assert.match(source, /role="combobox"/)
  assert.match(source, /aria-expanded=/)
  assert.match(source, /role="listbox"/)
  assert.match(source, /role="option"/)
  assert.match(source, /aria-selected=/)
  assert.match(source, /ArrowDown/)
  assert.match(source, /ArrowUp/)
  assert.match(source, /Escape/)
  assert.match(source, /BottomSheet/)
  assert.match(source, /onChange\(option\.value\)/)
})

test('desktop uses anchored dropdown and mobile uses sheet', async () => {
  const css = await read('./system-select.css')
  assert.match(css, /\.system-select-dropdown/)
  assert.match(css, /position:\s*absolute/)
  assert.match(css, /@media\s*\(max-width:\s*820px\)/)
  assert.match(css, /\.system-select-dropdown[\s\S]*display:\s*none/)
  assert.match(css, /min-height:\s*44px/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/systemSelect.test.js
```

Expected: FAIL because component/CSS do not exist.

- [ ] **Step 3: Implement state and keyboard contract**

In `SystemSelect.jsx`, use `useId`, `useRef`, `useState`, `useEffect`, `BottomSheet`, and `Icon`. Maintain `open` and `activeIndex`. Required handlers:

```jsx
const selected = options.find((option) => option.value === value)
const choose = (option) => {
  onChange(option.value)
  setOpen(false)
  window.requestAnimationFrame(() => triggerRef.current?.focus())
}

const openSelect = () => {
  if (disabled) return
  const index = options.findIndex((option) => option.value === value)
  setActiveIndex(index >= 0 ? index : 0)
  setOpen(true)
}

const handleKeyDown = (event) => {
  if (disabled) return
  if (event.key === 'Escape' && open) {
    event.preventDefault()
    setOpen(false)
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open) return openSelect()
    const offset = event.key === 'ArrowDown' ? 1 : -1
    setActiveIndex((current) => (current + offset + options.length) % options.length)
    return
  }
  if ((event.key === 'Enter' || event.key === ' ') && open) {
    event.preventDefault()
    const option = options[activeIndex]
    if (option) choose(option)
  }
}
```

Trigger markup:

```jsx
<button ref={triggerRef} type="button" className="system-select-trigger" role="combobox" aria-label={label} aria-expanded={open} aria-haspopup="listbox" disabled={disabled} onClick={() => open ? setOpen(false) : openSelect()} onKeyDown={handleKeyDown}>
  <span>{selected?.label || placeholder}</span><Icon name="arrow-down" size={16} />
</button>
```

Desktop dropdown while `open`:

```jsx
<div className="system-select-dropdown" role="listbox" aria-label={label} data-navigation-swipe-block="true">
  {options.map((option, index) => (
    <button key={option.value} type="button" className={index === activeIndex ? 'system-select-option active' : 'system-select-option'} role="option" aria-selected={option.value === value} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}>
      <span>{option.label}</span>{option.value === value && <Icon name="check" size={16} />}
    </button>
  ))}
</div>
```

Mobile surface uses the same options inside:

```jsx
<BottomSheet open={open} title={label} onClose={() => setOpen(false)}>
  <div className="system-select-sheet-options" role="listbox" aria-label={label}>
    {options.map((option) => (
      <button key={option.value} type="button" className="system-select-sheet-option" role="option" aria-selected={option.value === value} onClick={() => choose(option)}>
        <span>{option.label}</span>{option.value === value && <Icon name="check" size={18} />}
      </button>
    ))}
  </div>
</BottomSheet>
```

Add a `check` icon in `Icon.jsx`. Add an outside desktop mousedown listener that closes when `rootRef.current` does not contain `event.target`.

- [ ] **Step 4: Add responsive selector CSS**

Required core rules:

```css
.system-select { position: relative; min-width: 0; }
.system-select-trigger { width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: space-between; }
.system-select-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 45; }
.system-select-option { width: 100%; min-height: 42px; }
.system-select-sheet-option { width: 100%; min-height: 48px; }

@media (max-width: 820px) {
  .system-select-dropdown { display: none; }
}
```

Use existing surface/border/text/primary variables. `BottomSheet` supplies mobile backdrop, safe area and focus trap.

- [ ] **Step 5: Verify GREEN**

```bash
npm test -- src/systemSelect.test.js src/bottomSheet.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SystemSelect.jsx src/components/Icon.jsx src/system-select.css src/systemSelect.test.js
git commit -m "feat: add responsive system selector"
```

---

### Task 7: Migrate New Order selectors

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/components/OrderCheckoutSummary.jsx`
- Create: `src/newOrderSystemSelect.test.js`
- Modify: `src/pages/NewOrder.test.js` only to update markup expectations that intentionally changed.

**Interfaces:**
- Existing order type, adjustment, payment state and payload semantics remain unchanged.

- [ ] **Step 1: Write failing migration tests**

Create `src/newOrderSystemSelect.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('NewOrder uses SystemSelect for order type', async () => {
  const source = await read('./pages/NewOrder.jsx')
  assert.match(source, /import SystemSelect/)
  assert.match(source, /label="Tipo do pedido"/)
  assert.doesNotMatch(source, /<select/)
})

test('checkout uses SystemSelect for adjustment mode and payment', async () => {
  const source = await read('./components/OrderCheckoutSummary.jsx')
  assert.match(source, /import SystemSelect/)
  assert.match(source, /label="Ajuste do pedido"/)
  assert.match(source, /label="Modo"/)
  assert.match(source, /label="Forma de pagamento"/)
  assert.doesNotMatch(source, /<select/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/newOrderSystemSelect.test.js
```

Expected: FAIL while native selects remain.

- [ ] **Step 3: Replace order type**

In `NewOrder.jsx`:

```js
const ORDER_TYPE_OPTIONS = [
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Retirada', label: 'Retirada' },
  { value: 'Local', label: 'Consumo no local' },
]
```

Replace the native select with:

```jsx
<SystemSelect value={type} options={ORDER_TYPE_OPTIONS} onChange={changeType} disabled={disabled} label="Tipo do pedido" />
```

Keep the existing visible field label `<span>Tipo do pedido</span>`.

- [ ] **Step 4: Replace checkout choices**

In `OrderCheckoutSummary.jsx` define:

```js
const ADJUSTMENT_OPTIONS = [
  { value: 'none', label: 'Nenhum' },
  { value: 'discount', label: 'Desconto' },
  { value: 'surcharge', label: 'Acréscimo' },
]
const ADJUSTMENT_MODE_OPTIONS = [
  { value: 'fixed', label: 'R$' },
  { value: 'percentage', label: '%' },
]
const PAYMENT_METHOD_OPTIONS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']
  .map((method) => ({ value: method, label: method }))
```

Replace the three native selects with:

```jsx
<SystemSelect value={adjustment.type} options={ADJUSTMENT_OPTIONS} onChange={(type) => onAdjustmentChange({ type })} disabled={disabled} label="Ajuste do pedido" />
<SystemSelect value={adjustment.mode} options={ADJUSTMENT_MODE_OPTIONS} onChange={(mode) => onAdjustmentChange({ mode })} disabled={disabled} label="Modo" />
<SystemSelect value={paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={setPaymentMethod} disabled={disabled} label="Forma de pagamento" />
```

- [ ] **Step 5: Run affected tests**

```bash
npm test -- src/newOrderSystemSelect.test.js src/pages/NewOrder.test.js src/utils/orderCart.test.js src/utils/paymentWorkflow.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/NewOrder.jsx src/components/OrderCheckoutSummary.jsx src/newOrderSystemSelect.test.js src/pages/NewOrder.test.js
git commit -m "refactor: standardize new order selectors"
```

---

### Task 8: Migrate every remaining native selector and enforce zero JSX selects

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/Clients.jsx`
- Create: `src/systemSelectMigration.test.js`

**Interfaces:**
- Existing `paymentMethod`, `clientSort`, `newProduct.category`, `newMovement.type`, `newMovement.category` values remain unchanged.

- [ ] **Step 1: Write failing repository guard**

Create `src/systemSelectMigration.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const srcRoot = new URL('./', import.meta.url)

async function collectJsxFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl)
    if (entry.isDirectory()) files.push(...await collectJsxFiles(child))
    else if (extname(entry.name) === '.jsx') files.push(child)
  }
  return files
}

test('application JSX contains zero native select controls', async () => {
  const offenders = []
  for (const file of await collectJsxFiles(srcRoot)) {
    const source = await readFile(file, 'utf8')
    if (/<select\b/.test(source)) offenders.push(file.pathname)
  }
  assert.deepEqual(offenders, [])
})

test('App and Clients use SystemSelect for remaining fixed choices', async () => {
  const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')
  const clients = await readFile(new URL('./pages/Clients.jsx', import.meta.url), 'utf8')
  assert.match(app, /import SystemSelect/)
  assert.match(clients, /import SystemSelect/)
  assert.match(app, /label="Forma de pagamento"/)
  assert.match(app, /label="Categoria do produto"/)
  assert.match(app, /label="Tipo da movimentação"/)
  assert.match(app, /label="Categoria da movimentação"/)
  assert.match(clients, /label="Ordenar clientes"/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/systemSelectMigration.test.js
```

Expected: FAIL and report the JSX files with remaining native selects.

- [ ] **Step 3: Migrate client sorting**

In `Clients.jsx`:

```js
const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Nome A–Z' },
  { value: 'name-desc', label: 'Nome Z–A' },
]
```

Use:

```jsx
<SystemSelect value={sort} options={SORT_OPTIONS} onChange={onSortChange} label="Ordenar clientes" />
```

- [ ] **Step 4: Migrate `App.jsx` modal selectors**

Import `SystemSelect` and define:

```js
const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: method }))
const PRODUCT_CATEGORY_OPTIONS = ['Marmita', 'Bebida', 'Doce', 'Adicional'].map((value) => ({ value, label: value }))
const MOVEMENT_TYPE_OPTIONS = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
]
const MOVEMENT_CATEGORY_OPTIONS = ['Vendas', 'Delivery', 'Insumos', 'Despesas', 'Outros'].map((value) => ({ value, label: value }))
```

Payment modal:

```jsx
<SystemSelect value={paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={setPaymentMethod} disabled={writesBlocked} label="Forma de pagamento" />
```

Product category:

```jsx
<SystemSelect value={newProduct.category} options={PRODUCT_CATEGORY_OPTIONS} onChange={(category) => setNewProduct((current) => ({ ...current, category }))} disabled={writesBlocked} label="Categoria do produto" />
```

Movement type and category:

```jsx
<SystemSelect value={newMovement.type} options={MOVEMENT_TYPE_OPTIONS} onChange={(type) => setNewMovement((current) => ({ ...current, type }))} disabled={writesBlocked} label="Tipo da movimentação" />
<SystemSelect value={newMovement.category} options={MOVEMENT_CATEGORY_OPTIONS} onChange={(category) => setNewMovement((current) => ({ ...current, category }))} disabled={writesBlocked} label="Categoria da movimentação" />
```

Keep all surrounding visible labels and submit handlers.

- [ ] **Step 5: Run the repository guard until zero offenders**

```bash
npm test -- src/systemSelectMigration.test.js
```

Expected: PASS with an empty offender array. If the RED output identified an additional application-facing fixed-choice `<select>`, migrate that exact reported field to `SystemSelect` before proceeding; the date input and searchable client combobox are not `<select>` elements and remain unchanged.

- [ ] **Step 6: Run affected existing regressions**

```bash
npm test -- src/systemSelectMigration.test.js src/pages/ReceivablesDetails.test.js src/clientDuplicateUi.test.js src/operationsUxRound.test.js src/theme.test.js src/utils/paymentWorkflow.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/pages/Clients.jsx src/systemSelectMigration.test.js
git commit -m "refactor: standardize remaining system selectors"
```

---

### Task 9: Integrated responsive regression and final verification

**Files:**
- Create: `src/mobileUxIntegration.test.js`
- Modify only implementation/test files directly required to fix regressions introduced by Tasks 1–8.
- Do not modify production deployment workflow.

**Interfaces:**
- No new production interface. This task proves the spec as one integrated change.

- [ ] **Step 1: Write final integration guard**

Create `src/mobileUxIntegration.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile UX has bottom navigation, swipe exclusions and safe fixed layers', async () => {
  const shell = await read('./components/AppShell.jsx')
  const nav = await read('./components/MobileNavigation.jsx')
  const modal = await read('./components/Modal.jsx')
  const navCss = await read('./mobile-navigation.css')
  assert.match(shell, /onTouchStart=/)
  assert.match(nav, /BottomSheet/)
  assert.match(modal, /data-navigation-swipe-block/)
  assert.match(navCss, /z-index:\s*60/)
  assert.match(navCss, /safe-area-inset-bottom/)
})

test('desktop sidebar remains and mobile bottom nav is hidden outside breakpoint', async () => {
  const shell = await read('./components/AppShell.jsx')
  const navCss = await read('./mobile-navigation.css')
  assert.match(shell, /<Sidebar/)
  assert.match(navCss, /\.mobile-bottom-nav\s*\{[^}]*display:\s*none/s)
  assert.match(navCss, /@media\s*\(max-width:\s*820px\)[\s\S]*\.mobile-bottom-nav\s*\{[^}]*display:\s*grid/s)
})
```

- [ ] **Step 2: Run focused integration suite**

```bash
npm test -- src/mobileUxIntegration.test.js src/mobileNavigation.test.js src/mobileSwipeNavigation.test.js src/bottomSheet.test.js src/systemSelect.test.js src/orderTimerRefresh.test.js src/systemSelectMigration.test.js src/dashboardResponsive.test.js src/dashboardFloatingAction.test.js
```

Expected: PASS.

- [ ] **Step 3: Run complete tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 5: Build production assets**

```bash
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 6: Validate Worker bundle**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: success with the existing D1, rate limiter, and assets bindings.

- [ ] **Step 7: Re-run zero-select guard**

```bash
npm test -- src/systemSelectMigration.test.js
```

Expected: PASS; zero application JSX native selects.

- [ ] **Step 8: Review diff against every spec outcome**

Confirm the branch contains and tests all of these: mobile bottom bar + `Mais`; A Receber/Financeiro/theme/logout in `Mais`; focus-trapped sheet; deliberate mobile-only swipe through six main sections with no wrap and no New Order swipe; modal/selector swipe blocking; 60-second order timer plus resume refresh; custom desktop/mobile fixed-choice selector; zero native JSX selects; unchanged desktop sidebar behavior; no backend/business semantic changes.

- [ ] **Step 9: Commit verification corrections only if needed, then stop before integration/deploy**

Any correction must be limited to a concrete failed assertion/lint/build issue caused by this round and committed with a narrow message such as:

```bash
git add src/components/AppShell.jsx src/mobile-navigation.css src/mobileUxIntegration.test.js
git commit -m "fix: resolve mobile UX regression"
```

After verification, use `superpowers:finishing-a-development-branch` to present the user with the explicit integration choice. Do not merge to `master` and do not deploy production without that explicit choice.
