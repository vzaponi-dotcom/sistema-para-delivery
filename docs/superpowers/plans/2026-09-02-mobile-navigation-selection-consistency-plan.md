# Mobile Navigation and Selection Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver mobile bottom navigation with deliberate swipe navigation, keep order elapsed time current after app resume, and replace every application-facing native JSX `<select>` with one consistent system selector.

**Architecture:** `App.jsx` remains the owner of navigation and business state. Focused UI units handle a reusable accessible bottom sheet, mobile navigation, and fixed-option selection; a pure utility handles swipe rules. Desktop keeps the existing sidebar. `SystemSelect` uses an anchored dropdown on desktop and the shared bottom sheet on mobile.

**Tech Stack:** React 19, plain CSS, Node.js built-in test runner, Vite 8.2.2, oxlint, Cloudflare Wrangler 4.128.0. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-02-mobile-navigation-selection-consistency-design.md`

## Global Constraints

- Mobile breakpoint: `max-width: 820px`.
- Mobile section order: `dashboard → orders → clients → products → receivables → finance`.
- Bottom bar: Dashboard, Pedidos, Clientes, Produtos, Mais.
- `Mais` is active for `receivables` and `finance` and exposes A Receber, Financeiro, Tema, Sair do sistema.
- Swipe is mobile-only, one section per gesture, no wrap, and disabled on `new-order`.
- Swipe ignores controls, dialogs/listboxes, horizontal-interaction areas, and overlays.
- Orders retain a 60-second local clock update and refresh on visibility return/focus.
- Searchable client combobox, native date input, and theme segmented control remain specialized controls.
- Final target: zero application-facing JSX `<select>` elements.
- No backend, D1, API, auth, payment, pricing, or order workflow semantic changes.
- No new third-party dependencies.

---

### Task 1: Pure mobile swipe rules

**Files:**
- Create: `src/utils/mobileNavigation.js`
- Create: `src/utils/mobileNavigation.test.js`

**Interfaces:**
- Produces `MOBILE_SECTION_IDS`.
- Produces `getAdjacentMobileSection(activeTab, direction)`.
- Produces `getSwipeDirection({ deltaX, deltaY, threshold })`.
- Produces `shouldIgnoreNavigationSwipe(target)`.

- [ ] **Step 1: Write failing tests**

```js
// src/utils/mobileNavigation.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { MOBILE_SECTION_IDS, getAdjacentMobileSection, getSwipeDirection, shouldIgnoreNavigationSwipe } from './mobileNavigation.js'

test('approved mobile section order is stable', () => {
  assert.deepEqual(MOBILE_SECTION_IDS, ['dashboard', 'orders', 'clients', 'products', 'receivables', 'finance'])
})

test('adjacent navigation never wraps', () => {
  assert.equal(getAdjacentMobileSection('dashboard', 'previous'), 'dashboard')
  assert.equal(getAdjacentMobileSection('dashboard', 'next'), 'orders')
  assert.equal(getAdjacentMobileSection('products', 'next'), 'receivables')
  assert.equal(getAdjacentMobileSection('finance', 'next'), 'finance')
})

test('swipe needs dominant horizontal travel above 56px', () => {
  assert.equal(getSwipeDirection({ deltaX: -80, deltaY: 10, threshold: 56 }), 'next')
  assert.equal(getSwipeDirection({ deltaX: 80, deltaY: 10, threshold: 56 }), 'previous')
  assert.equal(getSwipeDirection({ deltaX: -40, deltaY: 5, threshold: 56 }), null)
  assert.equal(getSwipeDirection({ deltaX: -80, deltaY: 90, threshold: 56 }), null)
})

test('swipe ignores controls and overlay opt-outs', () => {
  const input = { tagName: 'INPUT', closest: () => null }
  const overlay = { tagName: 'DIV', closest: (selector) => selector.includes('[data-navigation-swipe-block]') ? {} : null }
  const plain = { tagName: 'DIV', closest: () => null }
  assert.equal(shouldIgnoreNavigationSwipe(input), true)
  assert.equal(shouldIgnoreNavigationSwipe(overlay), true)
  assert.equal(shouldIgnoreNavigationSwipe(plain), false)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/utils/mobileNavigation.test.js
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal helpers**

```js
// src/utils/mobileNavigation.js
export const MOBILE_SECTION_IDS = Object.freeze(['dashboard', 'orders', 'clients', 'products', 'receivables', 'finance'])

export const getAdjacentMobileSection = (activeTab, direction) => {
  const currentIndex = MOBILE_SECTION_IDS.indexOf(activeTab)
  if (currentIndex < 0) return activeTab
  const offset = direction === 'next' ? 1 : direction === 'previous' ? -1 : 0
  const index = Math.min(MOBILE_SECTION_IDS.length - 1, Math.max(0, currentIndex + offset))
  return MOBILE_SECTION_IDS[index]
}

export const getSwipeDirection = ({ deltaX, deltaY, threshold = 56 }) => {
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) return null
  return deltaX < 0 ? 'next' : 'previous'
}

export const shouldIgnoreNavigationSwipe = (target) => {
  if (!target) return false
  const tag = String(target.tagName || '').toLowerCase()
  if (['input', 'textarea', 'button', 'a', 'select'].includes(tag)) return true
  if (typeof target.closest !== 'function') return false
  return Boolean(target.closest('[role="dialog"], [role="listbox"], [data-horizontal-interaction], [data-navigation-swipe-block]'))
}
```

- [ ] **Step 4: Verify GREEN and commit**

```bash
npm test -- src/utils/mobileNavigation.test.js
git add src/utils/mobileNavigation.js src/utils/mobileNavigation.test.js
git commit -m "feat: add mobile swipe navigation rules"
```

---

### Task 2: Accessible reusable bottom sheet

**Files:**
- Create: `src/components/BottomSheet.jsx`
- Create: `src/bottom-sheet.css`
- Create: `src/bottomSheet.test.js`
- Modify: `src/components/Modal.jsx`

**Interfaces:**
- Produces `BottomSheet({ open, title, onClose, children })`.
- Owns backdrop close, Escape close, focus entry, Tab trap, focus restoration, dialog semantics, safe-area styling, and swipe blocking.

- [ ] **Step 1: Write failing tests**

```js
// src/bottomSheet.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('BottomSheet is focus-trapped and dismissible', async () => {
  const source = await read('./components/BottomSheet.jsx')
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /event\.key !== 'Tab'/)
  assert.match(source, /previousFocus/)
  assert.match(source, /data-navigation-swipe-block/)
})

test('Modal backdrop also blocks navigation swipe', async () => {
  const source = await read('./components/Modal.jsx')
  assert.match(source, /modal-backdrop[^>]*data-navigation-swipe-block/s)
})

test('sheet CSS respects safe area and touch targets', async () => {
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

- [ ] **Step 3: Implement the component**

```jsx
// src/components/BottomSheet.jsx
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
    const controls = () => Array.from(sheetRef.current?.querySelectorAll(focusable) || [])
    controls()[0]?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const items = controls()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
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
      <section ref={sheetRef} className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title} data-navigation-swipe-block="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="bottom-sheet-header">
          <strong>{title}</strong>
          <button type="button" className="icon-button icon-button-neutral" aria-label="Fechar" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </section>
    </div>
  )
}
export default BottomSheet
```

- [ ] **Step 4: Add CSS and mark existing Modal backdrop**

```css
/* src/bottom-sheet.css */
.bottom-sheet-backdrop { display: none; }
@media (max-width: 820px) {
  .bottom-sheet-backdrop { position: fixed; inset: 0; z-index: 90; display: flex; align-items: flex-end; background: rgba(0, 0, 0, 0.48); }
  .bottom-sheet { width: 100%; max-height: min(78vh, 620px); overflow-y: auto; overscroll-behavior: contain; padding: 18px 16px calc(18px + env(safe-area-inset-bottom)); border-radius: 22px 22px 0 0; background: var(--surface); color: var(--text); box-shadow: var(--shadow-lg); }
  .bottom-sheet-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  .bottom-sheet-header button { min-width: 44px; min-height: 44px; }
}
```

Change `Modal.jsx` backdrop opening tag to:

```jsx
<div className="modal-backdrop" data-navigation-swipe-block="true" onMouseDown={onClose}>
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm test -- src/bottomSheet.test.js src/uiPolish.test.js src/clientDuplicateUi.test.js
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
- Modify: `src/theme-controls.css`
- Modify: `src/App.css`
- Modify: `src/operationsUxRound.test.js`

**Interfaces:**
- Consumes `BottomSheet` and existing `useTheme()`.
- Produces `MobileNavigation({ activeTab, onNavigate, onLogout, logoutDisabled })`.
- Existing `menu` icon is already present in `src/components/Icon.jsx`; do not duplicate it.

- [ ] **Step 1: Write failing tests**

```js
// src/mobileNavigation.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile nav exposes four direct destinations plus Mais', async () => {
  const source = await read('./components/MobileNavigation.jsx')
  for (const label of ['Dashboard', 'Pedidos', 'Clientes', 'Produtos', 'Mais']) assert.match(source, new RegExp(label))
  assert.match(source, /aria-current=/)
  assert.match(source, /moreActive/)
})

test('Mais exposes secondary navigation theme and logout', async () => {
  const source = await read('./components/MobileNavigation.jsx')
  assert.match(source, /BottomSheet/)
  for (const label of ['A Receber', 'Financeiro', 'Claro', 'Escuro', 'Automático', 'Sair do sistema']) assert.match(source, new RegExp(label))
})

test('bottom bar is fixed safe-area aware and five columns wide', async () => {
  const css = await read('./mobile-navigation.css')
  assert.match(css, /position:\s*fixed/)
  assert.match(css, /safe-area-inset-bottom/)
  assert.match(css, /repeat\(5/)
})

test('old mobile logout and horizontal sidebar scroll are removed', async () => {
  const sidebar = await read('./components/Sidebar.jsx')
  const css = await read('./theme-controls.css')
  assert.doesNotMatch(sidebar, /sidebar-mobile-logout/)
  assert.doesNotMatch(css, /sidebar-mobile-logout/)
  assert.doesNotMatch(css, /sidebar-nav[\s\S]*overflow-x:\s*auto/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/mobileNavigation.test.js
```

- [ ] **Step 3: Implement `MobileNavigation`**

Use exact data:

```js
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
```

State/handlers:

```jsx
const [moreOpen, setMoreOpen] = useState(false)
const { themePreference, setThemePreference } = useTheme()
const moreActive = activeTab === 'receivables' || activeTab === 'finance'
const navigate = (id) => { onNavigate(id); setMoreOpen(false) }
```

Render the four mapped navigation buttons with icon+label and `aria-current="page"` on the active direct item. Render `Mais` with `aria-expanded` and `aria-haspopup="dialog"`. Its sheet body is:

```jsx
<BottomSheet open={moreOpen} title="Mais opções" onClose={() => setMoreOpen(false)}>
  <button type="button" className="mobile-more-action" onClick={() => navigate('receivables')}><Icon name="wallet" size={20} /><span>A Receber</span></button>
  <button type="button" className="mobile-more-action" onClick={() => navigate('finance')}><Icon name="finance" size={20} /><span>Financeiro</span></button>
  <div className="mobile-more-theme">
    <span>Tema</span>
    <div className="theme-segmented-control" role="group" aria-label="Tema do sistema">
      {themeOptions.map((option) => <button key={option.value} type="button" className={themePreference === option.value ? 'theme-option active' : 'theme-option'} aria-pressed={themePreference === option.value} onClick={() => setThemePreference(option.value)}><Icon name={option.icon} size={16} />{option.label}</button>)}
    </div>
  </div>
  {onLogout && <button type="button" className="mobile-more-logout" onClick={onLogout} disabled={logoutDisabled}>Sair do sistema</button>}
</BottomSheet>
```

- [ ] **Step 4: Integrate shell and remove old workaround**

`AppShell.jsx` renders `MobileNavigation` after `<main>` with the same navigation/logout props. Remove `sidebar-mobile-logout` JSX and CSS. Remove the mobile `.sidebar-nav` horizontal overflow override.

- [ ] **Step 5: Add mobile navigation CSS**

```css
.mobile-bottom-nav { display: none; }
@media (max-width: 820px) {
  .mobile-bottom-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); padding: 6px 6px calc(6px + env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: var(--surface); }
  .mobile-nav-item { min-width: 0; min-height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; }
  .mobile-nav-item span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mobile-nav-item.active { color: var(--primary); background: var(--primary-soft); }
  .mobile-more-action, .mobile-more-logout { width: 100%; min-height: 48px; }
  .app-content { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
  .dashboard-new-order-fab { bottom: calc(82px + env(safe-area-inset-bottom)); }
}
```

- [ ] **Step 6: Update old regression, verify, commit**

Change the final `operationsUxRound.test.js` responsive test to assert the new `MobileNavigation` contract instead of `sidebar-mobile-logout`/horizontal overflow.

```bash
npm test -- src/mobileNavigation.test.js src/operationsUxRound.test.js src/dashboardFloatingAction.test.js
git add src/components/MobileNavigation.jsx src/components/AppShell.jsx src/components/Sidebar.jsx src/mobile-navigation.css src/theme-controls.css src/App.css src/mobileNavigation.test.js src/operationsUxRound.test.js
git commit -m "feat: add mobile bottom navigation"
```

---

### Task 4: Mobile-only swipe integration

**Files:**
- Modify: `src/components/AppShell.jsx`
- Create: `src/mobileSwipeNavigation.test.js`

**Interfaces:**
- Consumes Task 1 helpers and existing `onNavigate`.

- [ ] **Step 1: Write failing test**

```js
// src/mobileSwipeNavigation.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('AppShell wires only mobile deliberate swipes', async () => {
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

- [ ] **Step 3: Implement touch tracking on `.app-main`**

```jsx
const touchStart = useRef(null)
const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches

const handleTouchStart = (event) => {
  if (!isMobileViewport() || activeTab === 'new-order' || shouldIgnoreNavigationSwipe(event.target)) { touchStart.current = null; return }
  const touch = event.touches[0]
  touchStart.current = { x: touch.clientX, y: touch.clientY }
}

const handleTouchEnd = (event) => {
  if (!touchStart.current || !isMobileViewport() || activeTab === 'new-order') return
  const touch = event.changedTouches[0]
  const direction = getSwipeDirection({ deltaX: touch.clientX - touchStart.current.x, deltaY: touch.clientY - touchStart.current.y })
  touchStart.current = null
  if (!direction) return
  const destination = getAdjacentMobileSection(activeTab, direction)
  if (destination !== activeTab) onNavigate(destination)
}
```

Do not call `preventDefault`.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/utils/mobileNavigation.test.js src/mobileSwipeNavigation.test.js src/bottomSheet.test.js
git add src/components/AppShell.jsx src/mobileSwipeNavigation.test.js
git commit -m "feat: add mobile swipe section navigation"
```

---

### Task 5: Resume-aware live order timer

**Files:**
- Modify: `src/pages/Orders.jsx`
- Create: `src/orderTimerRefresh.test.js`

- [ ] **Step 1: Write failing test**

```js
// src/orderTimerRefresh.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Orders refreshes every minute and after app resume', async () => {
  const source = await read('./pages/Orders.jsx')
  assert.match(source, /60_000/)
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

- [ ] **Step 3: Replace the interval-only effect**

```jsx
useEffect(() => {
  const refreshNow = () => setNow(new Date())
  const handleVisibilityChange = () => { if (document.visibilityState === 'visible') refreshNow() }
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

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/orderTimerRefresh.test.js src/operationsUxRound.test.js src/utils/orderWorkflow.test.js
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
- `options` is `{ value, label }[]`; `onChange(nextValue)` receives the selected value.
- Consumes `BottomSheet` only when the 820px media query is active.

- [ ] **Step 1: Write failing tests**

```js
// src/systemSelect.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('SystemSelect exposes keyboard combobox/listbox semantics', async () => {
  const source = await read('./components/SystemSelect.jsx')
  for (const pattern of [/role="combobox"/, /role="listbox"/, /role="option"/, /aria-selected=/, /ArrowDown/, /ArrowUp/, /Escape/, /BottomSheet/, /matchMedia/]) assert.match(source, pattern)
  assert.match(source, /onChange\(option\.value\)/)
})

test('desktop dropdown is anchored and hidden on mobile', async () => {
  const css = await read('./system-select.css')
  assert.match(css, /system-select-dropdown/)
  assert.match(css, /position:\s*absolute/)
  assert.match(css, /@media\s*\(max-width:\s*820px\)/)
  assert.match(css, /system-select-dropdown[^}]*display:\s*none/s)
  assert.match(css, /min-height:\s*44px/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/systemSelect.test.js
```

- [ ] **Step 3: Implement viewport state and selection behavior**

Use:

```jsx
const [open, setOpen] = useState(false)
const [activeIndex, setActiveIndex] = useState(0)
const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches)
const triggerRef = useRef(null)
const rootRef = useRef(null)
const selected = options.find((option) => option.value === value)

useEffect(() => {
  const media = window.matchMedia('(max-width: 820px)')
  const sync = () => setMobile(media.matches)
  sync()
  media.addEventListener('change', sync)
  return () => media.removeEventListener('change', sync)
}, [])

const choose = (option) => {
  onChange(option.value)
  setOpen(false)
  window.requestAnimationFrame(() => triggerRef.current?.focus())
}
```

`openSelect()` sets active index to current value. `handleKeyDown()` supports Escape, ArrowDown, ArrowUp, Enter and Space. Add a document `mousedown` listener while open that closes the desktop dropdown when the target is outside `rootRef`.

Trigger:

```jsx
<button ref={triggerRef} type="button" className="system-select-trigger" role="combobox" aria-label={label} aria-expanded={open} aria-haspopup={mobile ? 'dialog' : 'listbox'} disabled={disabled} onClick={() => open ? setOpen(false) : openSelect()} onKeyDown={handleKeyDown}>
  <span>{selected?.label || placeholder}</span><Icon name="arrow-down" size={16} />
</button>
```

Render the desktop dropdown only with `open && !mobile`:

```jsx
<div className="system-select-dropdown" role="listbox" aria-label={label} data-navigation-swipe-block="true">
  {options.map((option, index) => <button key={option.value} type="button" className={index === activeIndex ? 'system-select-option active' : 'system-select-option'} role="option" aria-selected={option.value === value} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}><span>{option.label}</span>{option.value === value && <Icon name="check" size={16} />}</button>)}
</div>
```

Render mobile options only through:

```jsx
<BottomSheet open={open && mobile} title={label} onClose={() => setOpen(false)}>
  <div className="system-select-sheet-options" role="listbox" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" className="system-select-sheet-option" role="option" aria-selected={option.value === value} onClick={() => choose(option)}><span>{option.label}</span>{option.value === value && <Icon name="check" size={18} />}</button>)}
  </div>
</BottomSheet>
```

Add this exact icon entry to `Icon.jsx`:

```jsx
check: <path d="m5 12 4 4L19 6"/>,
```

- [ ] **Step 4: Add selector CSS**

```css
.system-select { position: relative; min-width: 0; }
.system-select-trigger { width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: space-between; }
.system-select-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 45; }
.system-select-option { width: 100%; min-height: 42px; }
.system-select-sheet-option { width: 100%; min-height: 48px; }
@media (max-width: 820px) { .system-select-dropdown { display: none; } }
```

Complete visual styling with existing `--surface`, `--surface-soft`, `--border`, `--text`, `--muted`, `--primary`, `--primary-soft` variables.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/systemSelect.test.js src/bottomSheet.test.js
git add src/components/SystemSelect.jsx src/components/Icon.jsx src/system-select.css src/systemSelect.test.js
git commit -m "feat: add responsive system selector"
```

---

### Task 7: Migrate New Order selectors

**Files:**
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/components/OrderCheckoutSummary.jsx`
- Create: `src/newOrderSystemSelect.test.js`
- Modify: `src/pages/NewOrder.test.js` only where native-select markup expectations changed.

- [ ] **Step 1: Write failing tests**

```js
// src/newOrderSystemSelect.test.js
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
  for (const label of ['Ajuste do pedido', 'Modo', 'Forma de pagamento']) assert.match(source, new RegExp(`label="${label}"`))
  assert.doesNotMatch(source, /<select/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/newOrderSystemSelect.test.js
```

- [ ] **Step 3: Replace order type**

```js
const ORDER_TYPE_OPTIONS = [
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Retirada', label: 'Retirada' },
  { value: 'Local', label: 'Consumo no local' },
]
```

```jsx
<SystemSelect value={type} options={ORDER_TYPE_OPTIONS} onChange={changeType} disabled={disabled} label="Tipo do pedido" />
```

- [ ] **Step 4: Replace checkout choices**

```js
const ADJUSTMENT_OPTIONS = [{ value: 'none', label: 'Nenhum' }, { value: 'discount', label: 'Desconto' }, { value: 'surcharge', label: 'Acréscimo' }]
const ADJUSTMENT_MODE_OPTIONS = [{ value: 'fixed', label: 'R$' }, { value: 'percentage', label: '%' }]
const PAYMENT_METHOD_OPTIONS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro'].map((method) => ({ value: method, label: method }))
```

```jsx
<SystemSelect value={adjustment.type} options={ADJUSTMENT_OPTIONS} onChange={(type) => onAdjustmentChange({ type })} disabled={disabled} label="Ajuste do pedido" />
<SystemSelect value={adjustment.mode} options={ADJUSTMENT_MODE_OPTIONS} onChange={(mode) => onAdjustmentChange({ mode })} disabled={disabled} label="Modo" />
<SystemSelect value={paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={setPaymentMethod} disabled={disabled} label="Forma de pagamento" />
```

Keep all current conditional fields and checkout handlers.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/newOrderSystemSelect.test.js src/pages/NewOrder.test.js src/utils/orderCart.test.js src/utils/paymentWorkflow.test.js
git add src/pages/NewOrder.jsx src/components/OrderCheckoutSummary.jsx src/newOrderSystemSelect.test.js src/pages/NewOrder.test.js
git commit -m "refactor: standardize new order selectors"
```

---

### Task 8: Migrate remaining selectors and enforce zero native JSX selects

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/Clients.jsx`
- Create: `src/systemSelectMigration.test.js`

- [ ] **Step 1: Write failing repository guard**

```js
// src/systemSelectMigration.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { extname } from 'node:path'
const srcRoot = new URL('./', import.meta.url)

async function collectJsxFiles(directoryUrl) {
  const files = []
  for (const entry of await readdir(directoryUrl, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl)
    if (entry.isDirectory()) files.push(...await collectJsxFiles(child))
    else if (extname(entry.name) === '.jsx') files.push(child)
  }
  return files
}

test('application JSX contains zero native select controls', async () => {
  const offenders = []
  for (const file of await collectJsxFiles(srcRoot)) {
    if (/<select\b/.test(await readFile(file, 'utf8'))) offenders.push(file.pathname)
  }
  assert.deepEqual(offenders, [])
})

test('App and Clients import SystemSelect', async () => {
  assert.match(await readFile(new URL('./App.jsx', import.meta.url), 'utf8'), /import SystemSelect/)
  assert.match(await readFile(new URL('./pages/Clients.jsx', import.meta.url), 'utf8'), /import SystemSelect/)
})
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/systemSelectMigration.test.js
```

After Task 7, expected offenders are `src/App.jsx` and `src/pages/Clients.jsx`.

- [ ] **Step 3: Migrate Clients sorting**

```js
const SORT_OPTIONS = [{ value: 'name-asc', label: 'Nome A–Z' }, { value: 'name-desc', label: 'Nome Z–A' }]
```

```jsx
<SystemSelect value={sort} options={SORT_OPTIONS} onChange={onSortChange} label="Ordenar clientes" />
```

- [ ] **Step 4: Migrate `App.jsx` choices**

```js
const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: method }))
const PRODUCT_CATEGORY_OPTIONS = ['Marmita', 'Bebida', 'Doce', 'Adicional'].map((value) => ({ value, label: value }))
const MOVEMENT_TYPE_OPTIONS = [{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }]
const MOVEMENT_CATEGORY_OPTIONS = ['Vendas', 'Delivery', 'Insumos', 'Despesas', 'Outros'].map((value) => ({ value, label: value }))
```

Use:

```jsx
<SystemSelect value={paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={setPaymentMethod} disabled={writesBlocked} label="Forma de pagamento" />
<SystemSelect value={newProduct.category} options={PRODUCT_CATEGORY_OPTIONS} onChange={(category) => setNewProduct((current) => ({ ...current, category }))} disabled={writesBlocked} label="Categoria do produto" />
<SystemSelect value={newMovement.type} options={MOVEMENT_TYPE_OPTIONS} onChange={(type) => setNewMovement((current) => ({ ...current, type }))} disabled={writesBlocked} label="Tipo da movimentação" />
<SystemSelect value={newMovement.category} options={MOVEMENT_CATEGORY_OPTIONS} onChange={(category) => setNewMovement((current) => ({ ...current, category }))} disabled={writesBlocked} label="Categoria da movimentação" />
```

Keep visible labels and all existing submit/business handlers unchanged.

- [ ] **Step 5: Verify zero native selects and affected regressions**

```bash
npm test -- src/systemSelectMigration.test.js src/pages/ReceivablesDetails.test.js src/clientDuplicateUi.test.js src/operationsUxRound.test.js src/theme.test.js src/utils/paymentWorkflow.test.js
```

Expected: PASS and zero JSX `<select>` offenders.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/pages/Clients.jsx src/systemSelectMigration.test.js
git commit -m "refactor: standardize remaining system selectors"
```

---

### Task 9: Integrated responsive regression and verification

**Files:**
- Create: `src/mobileUxIntegration.test.js`
- Modify only files whose regressions are directly caused by Tasks 1–8.
- Do not modify deployment workflow.

- [ ] **Step 1: Write integration guard**

```js
// src/mobileUxIntegration.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('mobile UX combines bottom navigation swipe blocking and safe areas', async () => {
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

test('desktop sidebar remains while bottom nav is mobile-only', async () => {
  const shell = await read('./components/AppShell.jsx')
  const css = await read('./mobile-navigation.css')
  assert.match(shell, /<Sidebar/)
  assert.match(css, /\.mobile-bottom-nav\s*\{[^}]*display:\s*none/s)
  assert.match(css, /@media\s*\(max-width:\s*820px\)[\s\S]*\.mobile-bottom-nav\s*\{[^}]*display:\s*grid/s)
})
```

- [ ] **Step 2: Run focused integration suite**

```bash
npm test -- src/mobileUxIntegration.test.js src/mobileNavigation.test.js src/mobileSwipeNavigation.test.js src/bottomSheet.test.js src/systemSelect.test.js src/orderTimerRefresh.test.js src/systemSelectMigration.test.js src/dashboardResponsive.test.js src/dashboardFloatingAction.test.js
```

Expected: PASS.

- [ ] **Step 3: Run complete verification**

```bash
npm test
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npm test -- src/systemSelectMigration.test.js
```

Expected: all tests pass; lint reports `Found 0 warnings and 0 errors.`; Vite build succeeds; Wrangler dry-run succeeds with existing D1/rate-limiter/assets bindings; native-select guard passes.

- [ ] **Step 4: Review spec coverage**

Confirm in the final diff: bottom bar + `Mais`; A Receber/Financeiro/theme/logout; focus-trapped sheet; mobile-only swipe with boundaries and no New Order swipe; overlay swipe blocking; 60-second timer + resume refresh; desktop dropdown/mobile sheet selector; zero native JSX selects; unchanged desktop sidebar behavior; no backend/business semantic changes.

- [ ] **Step 5: Stop before integration/deploy**

If verification exposes a concrete regression, fix only that regression, rerun the failing check and full verification, and commit with a narrow `fix:` message. Then invoke `superpowers:finishing-a-development-branch`. Do not merge to `master` or deploy production until the user explicitly chooses that action.
