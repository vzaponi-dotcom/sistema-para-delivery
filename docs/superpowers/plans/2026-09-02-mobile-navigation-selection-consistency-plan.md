# Mobile Navigation and Selection Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a mobile-first navigation experience with bottom navigation and swipe gestures, keep order timing current after app resume, and replace every application-facing native JSX `<select>` with one consistent system selector.

**Architecture:** Keep `App.jsx` as the owner of application navigation and business state. Add focused presentation units for mobile navigation and fixed-option selection, plus a pure swipe utility that can be unit tested without a browser. Desktop keeps the existing sidebar; mobile gets a fixed bottom bar and `Mais` sheet. `SystemSelect` owns desktop dropdown/mobile sheet presentation while callers keep their existing values and change handlers.

**Tech Stack:** React 19, plain CSS, Node.js built-in test runner, Vite 8.2.2, oxlint, Cloudflare Wrangler 4.128.0. No new runtime or chart/UI dependencies.

**Spec:** `docs/superpowers/specs/2026-09-02-mobile-navigation-selection-consistency-design.md`

## Global Constraints

- Mobile breakpoint is `max-width: 820px`, matching the existing responsive sidebar breakpoint.
- Main mobile section order is exactly `Dashboard → Pedidos → Clientes → Produtos → A Receber → Financeiro`.
- Mobile bottom navigation exposes exactly four direct destinations plus `Mais`: Dashboard, Pedidos, Clientes, Produtos, Mais.
- `A Receber` and `Financeiro` are reached through `Mais`; when either is active, `Mais` is visually active.
- Swipe navigation never wraps and is disabled on `new-order` and while an overlay is open.
- Swipe must ignore gestures that start in `input`, `textarea`, `button`, `a`, dialogs, listboxes, or elements marked horizontally interactive.
- Orders keep the 60-second local clock cadence and refresh immediately on document visibility returning to `visible` and on window focus.
- `SystemSelect` presents a custom anchored dropdown on desktop and a bottom selection sheet on mobile.
- Existing theme persistence remains unchanged; the current Claro/Escuro/Automático segmented control is reused inside `Mais`.
- Existing searchable client combobox and native date input remain specialized controls and are not converted into `SystemSelect`.
- Target after migration: zero application-facing JSX `<select>` elements.
- No backend, D1 schema, API contract, authentication, payment rule, pricing rule, or order workflow semantics change.
- No new third-party dependencies.

---

### Task 1: Pure mobile swipe navigation rules

**Files:**
- Create: `src/utils/mobileNavigation.js`
- Create: `src/utils/mobileNavigation.test.js`

**Interfaces:**
- Produces: `MOBILE_SECTION_IDS`, an immutable ordered array of section ids.
- Produces: `getAdjacentMobileSection(activeTab, direction)` returning the adjacent section id or the current id at a boundary.
- Produces: `getSwipeDirection({ deltaX, deltaY, threshold })` returning `'next'`, `'previous'`, or `null`.
- Produces: `shouldIgnoreNavigationSwipe(target)` returning a boolean for interactive/opt-out origins.
- Later tasks consume these helpers from `AppShell.jsx`.

- [ ] **Step 1: Write the failing unit tests**

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

test('mobile sections keep the approved navigation order', () => {
  assert.deepEqual(MOBILE_SECTION_IDS, [
    'dashboard',
    'orders',
    'clients',
    'products',
    'receivables',
    'finance',
  ])
})

test('adjacent mobile navigation moves one section and never wraps', () => {
  assert.equal(getAdjacentMobileSection('dashboard', 'previous'), 'dashboard')
  assert.equal(getAdjacentMobileSection('dashboard', 'next'), 'orders')
  assert.equal(getAdjacentMobileSection('products', 'next'), 'receivables')
  assert.equal(getAdjacentMobileSection('finance', 'next'), 'finance')
})

test('swipe direction requires dominant horizontal travel above threshold', () => {
  assert.equal(getSwipeDirection({ deltaX: -80, deltaY: 12, threshold: 56 }), 'next')
  assert.equal(getSwipeDirection({ deltaX: 80, deltaY: 12, threshold: 56 }), 'previous')
  assert.equal(getSwipeDirection({ deltaX: -40, deltaY: 4, threshold: 56 }), null)
  assert.equal(getSwipeDirection({ deltaX: -80, deltaY: 90, threshold: 56 }), null)
})

test('navigation swipe ignores interactive and explicitly horizontal targets', () => {
  const makeTarget = ({ tagName = 'DIV', role = null, horizontal = false } = {}) => ({
    tagName,
    closest: (selector) => {
      if (horizontal && selector.includes('[data-horizontal-interaction]')) return {}
      if (role === 'dialog' && selector.includes('[role="dialog"]')) return {}
      if (role === 'listbox' && selector.includes('[role="listbox"]')) return {}
      return null
    },
  })

  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ tagName: 'INPUT' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ tagName: 'BUTTON' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ role: 'dialog' })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget({ horizontal: true })), true)
  assert.equal(shouldIgnoreNavigationSwipe(makeTarget()), false)
})
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
npm test -- src/utils/mobileNavigation.test.js
```

Expected: FAIL because `src/utils/mobileNavigation.js` does not exist.

- [ ] **Step 3: Implement the pure helpers minimally**

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
  return Boolean(target.closest('[role="dialog"], [role="listbox"], [data-horizontal-interaction]'))
}
```

- [ ] **Step 4: Run the focused test to verify GREEN**

Run:

```bash
npm test -- src/utils/mobileNavigation.test.js
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit the task**

```bash
git add src/utils/mobileNavigation.js src/utils/mobileNavigation.test.js
git commit -m "feat: add mobile swipe navigation rules"
```

---

### Task 2: Mobile bottom navigation and `Mais` sheet

**Files:**
- Create: `src/components/MobileNavigation.jsx`
- Create: `src/mobile-navigation.css`
- Create: `src/mobileNavigation.test.js`
- Modify: `src/components/AppShell.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/theme-controls.css`
- Modify: `src/App.css`

**Interfaces:**
- Consumes from Task 1: the six approved section ids/order indirectly through app navigation; no duplicated business state.
- Produces: `MobileNavigation({ activeTab, onNavigate, onLogout, logoutDisabled })`.
- `MobileNavigation` internally consumes `useTheme()` to reuse persisted theme state in `Mais`.
- `AppShell` continues to expose its existing public props and delegates them to both desktop `Sidebar` and mobile `MobileNavigation`.

- [ ] **Step 1: Write failing source-contract tests**

Create `src/mobileNavigation.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile navigation exposes four direct destinations plus Mais', async () => {
  const source = await read('./components/MobileNavigation.jsx')
  assert.match(source, /Dashboard/)
  assert.match(source, /Pedidos/)
  assert.match(source, /Clientes/)
  assert.match(source, /Produtos/)
  assert.match(source, /Mais/)
  assert.match(source, /A Receber/)
  assert.match(source, /Financeiro/)
  assert.match(source, /Sair do sistema/)
  assert.match(source, /aria-current=/)
})

test('Mais reuses the persisted theme selector and treats secondary sections as active', async () => {
  const source = await read('./components/MobileNavigation.jsx')
  assert.match(source, /useTheme/)
  assert.match(source, /Claro/)
  assert.match(source, /Escuro/)
  assert.match(source, /Automático/)
  assert.match(source, /receivables/)
  assert.match(source, /finance/)
  assert.match(source, /moreActive/)
})

test('mobile navigation is fixed, safe-area aware and content is offset', async () => {
  const css = await read('./mobile-navigation.css')
  assert.match(css, /position:\s*fixed/)
  assert.match(css, /safe-area-inset-bottom/)
  assert.match(css, /min-height:\s*44px/)
  assert.match(css, /\.mobile-more-backdrop/)
  assert.match(css, /\.mobile-more-sheet/)
})

test('old mobile horizontal sidebar navigation and temporary mobile logout are removed', async () => {
  const sidebar = await read('./components/Sidebar.jsx')
  const themeCss = await read('./theme-controls.css')
  assert.doesNotMatch(sidebar, /sidebar-mobile-logout/)
  assert.doesNotMatch(themeCss, /sidebar-mobile-logout/)
})
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
npm test -- src/mobileNavigation.test.js
```

Expected: FAIL because `MobileNavigation.jsx` and `mobile-navigation.css` do not exist and the old mobile logout still exists.

- [ ] **Step 3: Implement the mobile navigation component**

Create `src/components/MobileNavigation.jsx` with this structure and exact navigation data:

```jsx
import { useState } from 'react'
import '../mobile-navigation.css'
import Icon from './Icon'
import { useTheme } from './themeContext.js'

const directItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'orders', label: 'Pedidos', icon: 'orders' },
  { id: 'clients', label: 'Clientes', icon: 'clients' },
  { id: 'products', label: 'Produtos', icon: 'products' },
]

const themeOptions = [
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Escuro', icon: 'moon' },
  { value: 'system', label: 'Automático', icon: 'system' },
]

function MobileNavigation({ activeTab, onNavigate, onLogout, logoutDisabled = false }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { themePreference, setThemePreference } = useTheme()
  const moreActive = activeTab === 'receivables' || activeTab === 'finance'

  const navigate = (id) => {
    onNavigate(id)
    setMoreOpen(false)
  }

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Navegação principal">
        {directItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeTab === item.id ? 'mobile-nav-item active' : 'mobile-nav-item'}
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={moreActive ? 'mobile-nav-item active' : 'mobile-nav-item'}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen(true)}
        >
          <Icon name="menu" size={20} />
          <span>Mais</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-more-backdrop" onMouseDown={() => setMoreOpen(false)}>
          <section
            className="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Mais opções"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-more-header">
              <strong>Mais opções</strong>
              <button type="button" className="icon-button icon-button-neutral" aria-label="Fechar" onClick={() => setMoreOpen(false)}>
                <Icon name="close" size={20} />
              </button>
            </div>
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
                  <button
                    key={option.value}
                    type="button"
                    className={themePreference === option.value ? 'theme-option active' : 'theme-option'}
                    aria-pressed={themePreference === option.value}
                    onClick={() => setThemePreference(option.value)}
                  >
                    <Icon name={option.icon} size={16} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {onLogout && (
              <button type="button" className="mobile-more-logout" onClick={onLogout} disabled={logoutDisabled}>
                Sair do sistema
              </button>
            )}
          </section>
        </div>
      )}
    </>
  )
}

export default MobileNavigation
```

If `Icon` lacks `menu`, add one small three-line menu glyph in `src/components/Icon.jsx` in this task and include it in the commit.

- [ ] **Step 4: Integrate it into the shell and remove the temporary mobile logout**

Update `src/components/AppShell.jsx` to import and render `MobileNavigation` after `<main>` while preserving the existing props:

```jsx
import MobileNavigation from './MobileNavigation'
import Sidebar from './Sidebar'

function AppShell({ activeTab, onNavigate, onLogout, logoutDisabled = false, children }) {
  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} onNavigate={onNavigate} onLogout={onLogout} logoutDisabled={logoutDisabled} />
      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>
      <MobileNavigation
        activeTab={activeTab}
        onNavigate={onNavigate}
        onLogout={onLogout}
        logoutDisabled={logoutDisabled}
      />
    </div>
  )
}

export default AppShell
```

Delete the `sidebar-mobile-logout` button block from `src/components/Sidebar.jsx`. Delete all `.sidebar-mobile-logout` rules from `src/theme-controls.css`. Remove the mobile rule that makes `.sidebar-nav` horizontally scrollable; desktop sidebar rules remain unchanged.

- [ ] **Step 5: Add mobile-only layout CSS**

Create `src/mobile-navigation.css` with mobile-hidden-by-default and mobile-visible rules. Include these required declarations:

```css
.mobile-bottom-nav,
.mobile-more-backdrop {
  display: none;
}

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
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.08);
  }

  .mobile-nav-item {
    min-width: 0;
    min-height: 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: 0;
    border-radius: 11px;
    background: transparent;
    color: var(--muted);
    font-size: 0.64rem;
    font-weight: 750;
  }

  .mobile-nav-item.active {
    color: var(--primary);
    background: var(--primary-soft);
  }

  .mobile-more-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: flex-end;
    background: rgba(0, 0, 0, 0.48);
  }

  .mobile-more-sheet {
    width: 100%;
    max-height: min(78vh, 620px);
    overflow-y: auto;
    padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
    border-radius: 22px 22px 0 0;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-lg);
  }

  .mobile-more-action,
  .mobile-more-logout {
    width: 100%;
    min-height: 48px;
  }

  .app-content {
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
  }

  .dashboard-new-order-fab {
    bottom: calc(82px + env(safe-area-inset-bottom));
  }
}
```

Use existing theme variables only; do not add a new palette.

- [ ] **Step 6: Run focused tests and the existing responsive regression**

Run:

```bash
npm test -- src/mobileNavigation.test.js src/operationsUxRound.test.js src/dashboardFloatingAction.test.js
```

Expected: PASS. If the old `operationsUxRound.test.js` still asserts horizontal sidebar overflow or `sidebar-mobile-logout`, update that regression test in this task so it asserts the new bottom-navigation contract instead of the intentionally removed workaround.

- [ ] **Step 7: Commit the task**

```bash
git add src/components/MobileNavigation.jsx src/components/AppShell.jsx src/components/Sidebar.jsx src/components/Icon.jsx src/mobile-navigation.css src/mobileNavigation.test.js src/theme-controls.css src/App.css src/operationsUxRound.test.js
git commit -m "feat: add mobile bottom navigation"
```

---

### Task 3: Mobile page swipe integration

**Files:**
- Modify: `src/components/AppShell.jsx`
- Create: `src/mobileSwipeNavigation.test.js`

**Interfaces:**
- Consumes from Task 1: `getAdjacentMobileSection`, `getSwipeDirection`, `shouldIgnoreNavigationSwipe`.
- Produces: touch gesture handling around `.app-main` that calls the existing `onNavigate` callback.
- No changes to page/business components.

- [ ] **Step 1: Write the failing integration-source test**

Create `src/mobileSwipeNavigation.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('app shell wires deliberate touch swipes to adjacent mobile sections', async () => {
  const source = await read('./components/AppShell.jsx')
  assert.match(source, /getAdjacentMobileSection/)
  assert.match(source, /getSwipeDirection/)
  assert.match(source, /shouldIgnoreNavigationSwipe/)
  assert.match(source, /onTouchStart=/)
  assert.match(source, /onTouchEnd=/)
  assert.match(source, /activeTab !== 'new-order'/)
})
```

- [ ] **Step 2: Run the focused test to verify RED**

```bash
npm test -- src/mobileSwipeNavigation.test.js
```

Expected: FAIL because `AppShell.jsx` does not yet wire touch events.

- [ ] **Step 3: Add touch tracking to `AppShell.jsx`**

Use refs/state local to the shell rather than global document handlers. The implementation must follow this shape:

```jsx
import { useRef } from 'react'
import MobileNavigation from './MobileNavigation'
import Sidebar from './Sidebar'
import {
  getAdjacentMobileSection,
  getSwipeDirection,
  shouldIgnoreNavigationSwipe,
} from '../utils/mobileNavigation.js'

function AppShell({ activeTab, onNavigate, onLogout, logoutDisabled = false, children }) {
  const touchStart = useRef(null)

  const handleTouchStart = (event) => {
    if (activeTab === 'new-order' || shouldIgnoreNavigationSwipe(event.target)) {
      touchStart.current = null
      return
    }
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event) => {
    if (!touchStart.current || activeTab === 'new-order') return
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

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} onNavigate={onNavigate} onLogout={onLogout} logoutDisabled={logoutDisabled} />
      <main className="app-main" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="app-content">{children}</div>
      </main>
      <MobileNavigation activeTab={activeTab} onNavigate={onNavigate} onLogout={onLogout} logoutDisabled={logoutDisabled} />
    </div>
  )
}
```

The gesture does not call `preventDefault`, so ordinary vertical page scrolling remains native. Overlay-origin touches are ignored through the Task 1 helper; `new-order` is always disabled.

- [ ] **Step 4: Run unit and integration tests**

```bash
npm test -- src/utils/mobileNavigation.test.js src/mobileSwipeNavigation.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the task**

```bash
git add src/components/AppShell.jsx src/mobileSwipeNavigation.test.js
git commit -m "feat: add mobile swipe section navigation"
```

---

### Task 4: Resume-aware live order timer

**Files:**
- Modify: `src/pages/Orders.jsx`
- Create: `src/orderTimerRefresh.test.js`

**Interfaces:**
- Keeps existing `now` state and 60-second interval.
- Adds `visibilitychange` and `focus` listeners that call the same local `refreshNow()` function.
- Does not fetch bootstrap data or call the backend.

- [ ] **Step 1: Write the failing source-contract test**

Create `src/orderTimerRefresh.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('orders refresh elapsed time every minute and immediately after app resume', async () => {
  const source = await read('./pages/Orders.jsx')
  assert.match(source, /setInterval\([^)]*60_000/s)
  assert.match(source, /visibilitychange/)
  assert.match(source, /document\.visibilityState === 'visible'/)
  assert.match(source, /window\.addEventListener\('focus'/)
  assert.match(source, /removeEventListener\('focus'/)
})
```

- [ ] **Step 2: Run the focused test to verify RED**

```bash
npm test -- src/orderTimerRefresh.test.js
```

Expected: FAIL on the missing visibility/focus listeners.

- [ ] **Step 3: Replace the current interval-only effect with one shared refresh function**

Update the existing `useEffect` in `src/pages/Orders.jsx`:

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

Do not add backend polling.

- [ ] **Step 4: Run timing tests**

```bash
npm test -- src/orderTimerRefresh.test.js src/operationsUxRound.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the task**

```bash
git add src/pages/Orders.jsx src/orderTimerRefresh.test.js
git commit -m "fix: refresh order timer after app resume"
```

---

### Task 5: Reusable `SystemSelect` desktop dropdown and mobile sheet

**Files:**
- Create: `src/components/SystemSelect.jsx`
- Create: `src/system-select.css`
- Create: `src/systemSelect.test.js`

**Interfaces:**
- Produces component signature:
  `SystemSelect({ value, options, onChange, disabled = false, label, id, placeholder = 'Selecione' })`.
- `options` is an array of `{ value: string, label: string }`.
- `onChange(nextValue)` receives the selected option value only.
- Later tasks replace native selects with this component without changing business state shape.

- [ ] **Step 1: Write the failing component contract tests**

Create `src/systemSelect.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('SystemSelect exposes custom combobox/listbox semantics and selected state', async () => {
  const source = await read('./components/SystemSelect.jsx')
  assert.match(source, /role="combobox"/)
  assert.match(source, /aria-expanded=/)
  assert.match(source, /role="listbox"/)
  assert.match(source, /role="option"/)
  assert.match(source, /aria-selected=/)
  assert.match(source, /Escape/)
  assert.match(source, /ArrowDown/)
  assert.match(source, /ArrowUp/)
  assert.match(source, /onChange\(option\.value\)/)
})

test('SystemSelect has desktop dropdown and mobile sheet presentation', async () => {
  const css = await read('./system-select.css')
  assert.match(css, /\.system-select-dropdown/)
  assert.match(css, /position:\s*absolute/)
  assert.match(css, /@media\s*\(max-width:\s*820px\)/)
  assert.match(css, /\.system-select-backdrop/)
  assert.match(css, /\.system-select-sheet/)
  assert.match(css, /safe-area-inset-bottom/)
  assert.match(css, /min-height:\s*44px/)
})
```

- [ ] **Step 2: Run the focused test to verify RED**

```bash
npm test -- src/systemSelect.test.js
```

Expected: FAIL because the component and stylesheet do not exist.

- [ ] **Step 3: Implement `SystemSelect` state, keyboard behavior, and both surfaces**

Create `src/components/SystemSelect.jsx`. Use this concrete state/interaction contract:

```jsx
import { useEffect, useId, useRef, useState } from 'react'
import '../system-select.css'
import Icon from './Icon'

function SystemSelect({ value, options, onChange, disabled = false, label, id, placeholder = 'Selecione' }) {
  const generatedId = useId()
  const selectId = id || generatedId
  const listboxId = `${selectId}-options`
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)))
  const selected = options.find((option) => option.value === value)

  const close = () => {
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const choose = (option) => {
    onChange(option.value)
    close()
  }

  const openSelect = () => {
    if (disabled) return
    const selectedIndex = options.findIndex((option) => option.value === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  const handleKeyDown = (event) => {
    if (disabled) return
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        close()
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openSelect()
        return
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + direction + options.length) % options.length)
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault()
      const option = options[activeIndex]
      if (option) choose(option)
    }
  }

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div className="system-select" ref={rootRef}>
      <button
        id={selectId}
        ref={triggerRef}
        type="button"
        className="system-select-trigger"
        role="combobox"
        aria-label={label}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => open ? close() : openSelect()}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label || placeholder}</span>
        <Icon name="arrow-down" size={16} />
      </button>

      {open && (
        <>
          <div className="system-select-dropdown" id={listboxId} role="listbox" aria-label={label}>
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                className={index === activeIndex ? 'system-select-option active' : 'system-select-option'}
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.value === value && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
          <div className="system-select-backdrop" onMouseDown={close}>
            <section className="system-select-sheet" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => event.stopPropagation()}>
              <div className="system-select-sheet-header"><strong>{label}</strong><button type="button" className="icon-button icon-button-neutral" aria-label="Fechar" onClick={close}><Icon name="close" size={20} /></button></div>
              <div role="listbox" aria-label={label}>
                {options.map((option) => (
                  <button key={option.value} type="button" className="system-select-sheet-option" role="option" aria-selected={option.value === value} onClick={() => choose(option)}>
                    <span>{option.label}</span>
                    {option.value === value && <Icon name="check" size={18} />}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

export default SystemSelect
```

If `Icon` lacks `check`, add a small checkmark glyph in `src/components/Icon.jsx` during this task.

- [ ] **Step 4: Add responsive selector CSS**

Create `src/system-select.css` so `.system-select-dropdown` is the only visible option surface on desktop and `.system-select-backdrop` is hidden there. At `max-width: 820px`, hide `.system-select-dropdown` and show `.system-select-backdrop`/`.system-select-sheet`.

The CSS must include these concrete behaviors:

```css
.system-select { position: relative; min-width: 0; }
.system-select-trigger { width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: space-between; }
.system-select-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 45; }
.system-select-option { width: 100%; min-height: 42px; }
.system-select-backdrop { display: none; }

@media (max-width: 820px) {
  .system-select-dropdown { display: none; }
  .system-select-backdrop { position: fixed; inset: 0; z-index: 90; display: flex; align-items: flex-end; background: rgba(0, 0, 0, 0.48); }
  .system-select-sheet { width: 100%; padding: 18px 16px calc(18px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; background: var(--surface); }
  .system-select-sheet-option { width: 100%; min-height: 48px; }
}
```

Use existing `var(--surface)`, `var(--surface-soft)`, `var(--border)`, `var(--text)`, `var(--muted)`, `var(--primary)`, and `var(--primary-soft)` tokens for the rest of the styling.

- [ ] **Step 5: Run focused tests**

```bash
npm test -- src/systemSelect.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the task**

```bash
git add src/components/SystemSelect.jsx src/components/Icon.jsx src/system-select.css src/systemSelect.test.js
git commit -m "feat: add responsive system selector"
```

---

### Task 6: Migrate New Order fixed-choice controls to `SystemSelect`

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/components/OrderCheckoutSummary.jsx`
- Create: `src/newOrderSystemSelect.test.js`
- Modify: `src/pages/NewOrder.test.js` only if an existing assertion explicitly expects native `<select>` markup.

**Interfaces:**
- Consumes from Task 5: `SystemSelect` with `{ value, options, onChange, disabled, label }`.
- Existing `changeType`, `handleAdjustmentChange`, `setPaymentMethod`, order payload, pricing preview, and checkout actions remain unchanged.

- [ ] **Step 1: Write failing migration tests**

Create `src/newOrderSystemSelect.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('New Order uses SystemSelect for order type', async () => {
  const source = await read('./pages/NewOrder.jsx')
  assert.match(source, /import SystemSelect/)
  assert.match(source, /label="Tipo do pedido"/)
  assert.doesNotMatch(source, /<select/)
})

test('checkout uses SystemSelect for adjustment, mode and payment method', async () => {
  const source = await read('./components/OrderCheckoutSummary.jsx')
  assert.match(source, /import SystemSelect/)
  assert.match(source, /label="Ajuste do pedido"/)
  assert.match(source, /label="Modo"/)
  assert.match(source, /label="Forma de pagamento"/)
  assert.doesNotMatch(source, /<select/)
})
```

- [ ] **Step 2: Run the focused test to verify RED**

```bash
npm test -- src/newOrderSystemSelect.test.js
```

Expected: FAIL while native selects remain.

- [ ] **Step 3: Replace order type selection**

In `src/pages/NewOrder.jsx`, import `SystemSelect` and define:

```js
const ORDER_TYPE_OPTIONS = [
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Retirada', label: 'Retirada' },
  { value: 'Local', label: 'Consumo no local' },
]
```

Replace the native order-type `<select>` with:

```jsx
<label className="form-field">
  <span>Tipo do pedido</span>
  <SystemSelect
    value={type}
    options={ORDER_TYPE_OPTIONS}
    onChange={changeType}
    disabled={disabled}
    label="Tipo do pedido"
  />
</label>
```

- [ ] **Step 4: Replace checkout fixed-choice selections**

In `src/components/OrderCheckoutSummary.jsx`, import `SystemSelect` and convert the existing constants into option objects:

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

Use:

```jsx
<SystemSelect value={adjustment.type} options={ADJUSTMENT_OPTIONS} onChange={(nextType) => onAdjustmentChange({ type: nextType })} disabled={disabled} label="Ajuste do pedido" />
<SystemSelect value={adjustment.mode} options={ADJUSTMENT_MODE_OPTIONS} onChange={(nextMode) => onAdjustmentChange({ mode: nextMode })} disabled={disabled} label="Modo" />
<SystemSelect value={paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={setPaymentMethod} disabled={disabled} label="Forma de pagamento" />
```

Preserve the existing conditional rendering for mode/value/reason and payment actions.

- [ ] **Step 5: Run New Order and cart/checkout regressions**

```bash
npm test -- src/newOrderSystemSelect.test.js src/pages/NewOrder.test.js src/orderCart.test.js
```

Expected: PASS. If the exact cart test file name differs, run the existing test file that covers `buildOrderPayload` and `calculateOrderPreview` discovered in the repository before committing.

- [ ] **Step 6: Commit the task**

```bash
git add src/pages/NewOrder.jsx src/components/OrderCheckoutSummary.jsx src/newOrderSystemSelect.test.js src/pages/NewOrder.test.js
git commit -m "refactor: standardize new order selectors"
```

---

### Task 7: Migrate remaining application selectors and enforce zero native JSX selects

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/Clients.jsx`
- Create: `src/systemSelectMigration.test.js`
- Modify existing tests that explicitly assert native select markup only when the expected behavior is intentionally replaced by `SystemSelect`.

**Interfaces:**
- Consumes from Task 5: `SystemSelect`.
- Existing `paymentMethod`, `clientSort`, `newProduct.category`, `newMovement.type`, and `newMovement.category` state shapes remain unchanged.
- No backend/API payload changes.

- [ ] **Step 1: Write the failing repository migration test**

Create `src/systemSelectMigration.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const srcRoot = new URL('./', import.meta.url)

async function collectJsxFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const childUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl)
    if (entry.isDirectory()) files.push(...await collectJsxFiles(childUrl))
    else if (extname(entry.name) === '.jsx') files.push(childUrl)
  }
  return files
}

test('application JSX contains no native select controls', async () => {
  const files = await collectJsxFiles(srcRoot)
  const offenders = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    if (/<select\b/.test(source)) offenders.push(file.pathname)
  }
  assert.deepEqual(offenders, [])
})

test('remaining fixed-choice flows import SystemSelect', async () => {
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

Remove the unused `join` import if oxlint flags it; the test does not require it.

- [ ] **Step 2: Run the focused test to verify RED**

```bash
npm test -- src/systemSelectMigration.test.js
```

Expected: FAIL and list the remaining JSX files containing native `<select>` elements.

- [ ] **Step 3: Migrate Clients sorting**

In `src/pages/Clients.jsx`, import `SystemSelect` and define:

```js
const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Nome A–Z' },
  { value: 'name-desc', label: 'Nome Z–A' },
]
```

Replace the sort native select with:

```jsx
<label className="sort-control">
  <span>Ordenar</span>
  <SystemSelect value={sort} options={SORT_OPTIONS} onChange={onSortChange} label="Ordenar clientes" />
</label>
```

- [ ] **Step 4: Migrate payment, product and movement modal selectors in `App.jsx`**

Import `SystemSelect` and define reusable option arrays near the existing constants:

```js
const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: method }))
const PRODUCT_CATEGORY_OPTIONS = ['Marmita', 'Bebida', 'Doce', 'Adicional'].map((value) => ({ value, label: value }))
const MOVEMENT_TYPE_OPTIONS = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
]
const MOVEMENT_CATEGORY_OPTIONS = ['Vendas', 'Delivery', 'Insumos', 'Despesas', 'Outros'].map((value) => ({ value, label: value }))
```

Replace the payment modal field with:

```jsx
<label className="form-field">
  <span>Forma de pagamento</span>
  <SystemSelect value={paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={setPaymentMethod} disabled={writesBlocked} label="Forma de pagamento" />
</label>
```

Replace the product category field with:

```jsx
<label className="form-field">
  <span>Categoria</span>
  <SystemSelect
    value={newProduct.category}
    options={PRODUCT_CATEGORY_OPTIONS}
    onChange={(category) => setNewProduct((current) => ({ ...current, category }))}
    disabled={writesBlocked}
    label="Categoria do produto"
  />
</label>
```

Replace movement type/category with:

```jsx
<SystemSelect value={newMovement.type} options={MOVEMENT_TYPE_OPTIONS} onChange={(type) => setNewMovement((current) => ({ ...current, type }))} disabled={writesBlocked} label="Tipo da movimentação" />
<SystemSelect value={newMovement.category} options={MOVEMENT_CATEGORY_OPTIONS} onChange={(category) => setNewMovement((current) => ({ ...current, category }))} disabled={writesBlocked} label="Categoria da movimentação" />
```

Keep the surrounding labels/headings and all submit handlers unchanged.

- [ ] **Step 5: Use the failing test's offender list to migrate any additional application-facing JSX native select discovered**

For each path reported by `systemSelectMigration.test.js`, convert only fixed-choice application selectors to `SystemSelect`. Do not convert `<input type="date">` or the searchable New Order client combobox. Re-run after each file until the offender array is empty:

```bash
npm test -- src/systemSelectMigration.test.js
```

Expected final result: PASS with `offenders` equal to `[]`.

- [ ] **Step 6: Run affected flow regressions**

```bash
npm test -- src/systemSelectMigration.test.js src/receivablesDetails.test.js src/clientIdentityUi.test.js src/operationsUxRound.test.js
```

If one of those exact historical filenames is not present, run the existing test file in `src/` that covers the corresponding Receivables, client, product/movement, and theme flow. The required result is that all existing tests for the modified flows pass; do not delete business-behavior assertions to make the migration green.

- [ ] **Step 7: Commit the task**

```bash
git add src/App.jsx src/pages/Clients.jsx src/systemSelectMigration.test.js
git add src/*.test.js src/pages/*.test.js
git commit -m "refactor: standardize remaining system selectors"
```

---

### Task 8: Overlay/swipe coordination and responsive regression coverage

**Files:**
- Modify: `src/components/AppShell.jsx`
- Modify: `src/components/MobileNavigation.jsx`
- Modify: `src/components/SystemSelect.jsx`
- Create: `src/mobileUxIntegration.test.js`
- Modify: `src/mobile-navigation.css`
- Modify: `src/system-select.css`

**Interfaces:**
- Produces one shared DOM opt-out convention: overlays and their triggers use `data-navigation-swipe-block="true"` where needed.
- `shouldIgnoreNavigationSwipe` is extended to recognize `[data-navigation-swipe-block]` in addition to dialogs/listboxes/interactive elements.
- No global overlay store is introduced; the swipe is blocked by gesture origin and by `new-order`, while backdrop/dialog surfaces prevent page-origin gestures during overlays.

- [ ] **Step 1: Write failing integration regression tests**

Create `src/mobileUxIntegration.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile overlays explicitly block page swipe navigation', async () => {
  const more = await read('./components/MobileNavigation.jsx')
  const select = await read('./components/SystemSelect.jsx')
  const helper = await read('./utils/mobileNavigation.js')
  assert.match(more, /data-navigation-swipe-block/)
  assert.match(select, /data-navigation-swipe-block/)
  assert.match(helper, /data-navigation-swipe-block/)
})

test('mobile navigation and selector layers sit above fixed content', async () => {
  const navCss = await read('./mobile-navigation.css')
  const selectCss = await read('./system-select.css')
  assert.match(navCss, /z-index:\s*60/)
  assert.match(navCss, /z-index:\s*80/)
  assert.match(selectCss, /z-index:\s*90/)
})

test('desktop sidebar remains visible while bottom navigation is mobile-only', async () => {
  const navCss = await read('./mobile-navigation.css')
  assert.match(navCss, /\.mobile-bottom-nav[\s\S]*display:\s*none/)
  assert.match(navCss, /@media\s*\(max-width:\s*820px\)[\s\S]*\.mobile-bottom-nav[\s\S]*display:\s*grid/)
})
```

- [ ] **Step 2: Run the focused test to verify RED**

```bash
npm test -- src/mobileUxIntegration.test.js
```

Expected: FAIL until the explicit swipe-block markers are present.

- [ ] **Step 3: Add explicit overlay swipe-block markers**

Add `data-navigation-swipe-block="true"` to:

```jsx
<section className="mobile-more-sheet" data-navigation-swipe-block="true" ...>
<section className="system-select-sheet" data-navigation-swipe-block="true" ...>
<div className="system-select-dropdown" data-navigation-swipe-block="true" ...>
```

Extend Task 1's helper selector to:

```js
return Boolean(target.closest('[role="dialog"], [role="listbox"], [data-horizontal-interaction], [data-navigation-swipe-block]'))
```

This keeps the no-global-overlay-store design while making the exclusion explicit and testable.

- [ ] **Step 4: Verify fixed-layer spacing and narrow-width labels manually in CSS source**

Ensure the final CSS keeps:

```css
.mobile-nav-item span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-more-sheet, .system-select-sheet { overscroll-behavior: contain; }
```

Keep option rows at least 44px high and keep the FAB bottom offset above the bottom bar.

- [ ] **Step 5: Run integration and responsive regressions**

```bash
npm test -- src/mobileUxIntegration.test.js src/mobileNavigation.test.js src/mobileSwipeNavigation.test.js src/systemSelect.test.js src/dashboardResponsive.test.js src/dashboardFloatingAction.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the task**

```bash
git add src/components/AppShell.jsx src/components/MobileNavigation.jsx src/components/SystemSelect.jsx src/utils/mobileNavigation.js src/mobile-navigation.css src/system-select.css src/mobileUxIntegration.test.js
git commit -m "test: harden mobile navigation interactions"
```

---

### Task 9: Final regression, lint, production build, Worker dry-run, and branch review

**Files:**
- Modify only files required to fix failures directly caused by Tasks 1–8.
- Do not modify deployment workflow in this task.

**Interfaces:**
- No new interfaces. This task proves the integrated branch satisfies the spec.

- [ ] **Step 1: Run the complete automated test suite**

```bash
npm test
```

Expected: all tests pass, including new mobile navigation, swipe, timer, selector, migration, and integration tests.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 3: Build production assets**

```bash
npm run build
```

Expected: Vite build succeeds without errors.

- [ ] **Step 4: Validate the Worker bundle**

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: Wrangler dry-run succeeds and still reports the existing D1, rate limiter, and assets bindings.

- [ ] **Step 5: Re-run the native-select repository guard alone**

```bash
npm test -- src/systemSelectMigration.test.js
```

Expected: PASS; zero application JSX `<select>` offenders.

- [ ] **Step 6: Review the branch diff against the spec**

Confirm every spec outcome has implementation/tests:

- mobile bottom bar + `Mais`;
- A Receber, Financeiro, Tema, and logout reachable from `Mais`;
- deliberate swipe through all six main sections with boundaries and safety exclusions;
- no swipe on New Order;
- order timer 60-second cadence + visibility/focus refresh;
- `SystemSelect` desktop dropdown + mobile sheet;
- all fixed-choice native selects migrated;
- no business/backend semantic changes;
- desktop sidebar unchanged in behavior.

- [ ] **Step 7: Commit any verification-only corrections, then leave integration/deploy for an explicit finishing choice**

If verification required code corrections, commit only those corrections with a narrow message such as:

```bash
git add <exact corrected files>
git commit -m "fix: resolve mobile UX regression"
```

Do not merge to `master` and do not deploy production until the finishing-development-branch flow presents the user with the explicit integration/deploy choice.
