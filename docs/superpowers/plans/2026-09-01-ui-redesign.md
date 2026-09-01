# Sistema para Delivery UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing React/Vite delivery manager into a polished Amor & Sabor SaaS-style interface without changing its current business logic or localStorage persistence.

**Architecture:** Keep application state and mutation handlers in `App.jsx`, extract view-level rendering into focused page components, and centralize visual behavior through shared UI components and CSS design tokens. Avoid new runtime dependencies; use React, CSS, and inline SVG icons only.

**Tech Stack:** React 19, React DOM 19, Vite 8, CSS, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-01-ui-redesign-design.md`

## Global Constraints

- Implement directly on `master`.
- Preserve existing localStorage keys and data shapes.
- Preserve current order/client/product/movement calculations and CRUD behavior.
- Do not add Tailwind, shadcn, a global state library, backend, auth, payments, or fabricated analytics.
- Use the existing Amor & Sabor brand identity, with deep red as primary color and restrained semantic status colors.
- Maintain responsive behavior and accessibility.
- Do not modify Cloudflare deployment configuration.

---

### Task 1: Establish the Design System and Application Shell

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.css`
- Modify: `src/components/BrandLogo.jsx`
- Create: `src/components/Icon.jsx`
- Create: `src/components/Sidebar.jsx`
- Create: `src/components/AppShell.jsx`

**Interfaces:**
- `Icon({ name, size = 20, className = '' })` returns an inline SVG for supported UI icon names.
- `Sidebar({ activeTab, onNavigate })` renders Dashboard/Pedidos/Clientes/Produtos/Financeiro navigation.
- `AppShell({ activeTab, onNavigate, children })` wraps the sidebar and main content.

- [ ] **Step 1: Define global design tokens in `src/index.css`**

Use CSS custom properties for background, surface, text, muted text, border, primary, primary-hover, success, warning, danger, info, radius, and shadow values. Apply `box-sizing: border-box`, a modern system font stack, readable body defaults, and visible `:focus-visible` styling.

- [ ] **Step 2: Create `Icon.jsx`**

Implement a dependency-free SVG icon component with at least these names: `dashboard`, `orders`, `clients`, `products`, `finance`, `plus`, `search`, `edit`, `trash`, `close`, `wallet`, `receipt`, `ticket`, `package`, `arrow-up`, `arrow-down`, `menu`.

Each icon must use `currentColor`, `aria-hidden="true"`, and a `viewBox="0 0 24 24"`.

- [ ] **Step 3: Create `Sidebar.jsx`**

Render the Amor & Sabor mark using `BrandLogo variant="mark"`, a compact brand label, and five semantic navigation buttons. Use `aria-current="page"` on the active item and call `onNavigate(tab)` for navigation.

- [ ] **Step 4: Create `AppShell.jsx`**

Compose `<Sidebar />` and a main content container with responsive class names. Keep mobile navigation controlled entirely with CSS rather than introducing new application state.

- [ ] **Step 5: Replace the old shell styles in `App.css`**

Create the desktop sidebar/main layout, responsive mobile layout, navigation active/hover/focus states, content width rules, and warm neutral visual foundation.

- [ ] **Step 6: Run static checks**

Run:

```bash
npm run lint
npm run build
```

Expected: both exit successfully.

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/App.css src/components/BrandLogo.jsx src/components/Icon.jsx src/components/Sidebar.jsx src/components/AppShell.jsx
git commit -m "feat: establish delivery app design system"
```

---

### Task 2: Build Shared UI Components

**Files:**
- Create: `src/components/Button.jsx`
- Create: `src/components/PageHeader.jsx`
- Create: `src/components/StatCard.jsx`
- Create: `src/components/StatusBadge.jsx`
- Create: `src/components/Modal.jsx`
- Modify: `src/App.css`

**Interfaces:**
- `Button({ variant = 'primary', icon, children, className = '', ...props })`
- `PageHeader({ eyebrow, title, description, actions })`
- `StatCard({ label, value, helper, icon, tone = 'neutral' })`
- `StatusBadge({ status })`
- `Modal({ title, onClose, children, footer })`

- [ ] **Step 1: Implement `Button.jsx`**

Support `primary`, `secondary`, `ghost`, and `danger` variants. Render optional `Icon` by name and preserve all native button props.

- [ ] **Step 2: Implement `PageHeader.jsx`**

Render optional eyebrow, title, description, and right-aligned actions with responsive wrapping.

- [ ] **Step 3: Implement `StatCard.jsx`**

Render a compact icon tile, metric label/value, and helper text. Support restrained `neutral`, `success`, `warning`, and `danger` tones.

- [ ] **Step 4: Implement `StatusBadge.jsx`**

Map `Pendente`, `Em preparo`, `Pronto`, and `Entregue` to semantic classes while always displaying the status text.

- [ ] **Step 5: Implement `Modal.jsx`**

Provide backdrop click-to-close, stop propagation on the dialog, semantic `role="dialog"`, `aria-modal="true"`, close button with `aria-label="Fechar"`, content section, and optional footer.

- [ ] **Step 6: Add component styles**

In `App.css`, style buttons, headers, KPI cards, badges, modal surfaces/backdrops, icon buttons, and common form controls using the design tokens from Task 1.

- [ ] **Step 7: Run static checks**

```bash
npm run lint
npm run build
```

Expected: both exit successfully.

- [ ] **Step 8: Commit**

```bash
git add src/components/Button.jsx src/components/PageHeader.jsx src/components/StatCard.jsx src/components/StatusBadge.jsx src/components/Modal.jsx src/App.css
git commit -m "feat: add reusable UI components"
```

---

### Task 3: Extract and Redesign Dashboard and Orders

**Files:**
- Create: `src/pages/Dashboard.jsx`
- Create: `src/pages/Orders.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- `Dashboard({ totals, orders, currency, onNewOrder })`
- `Orders({ orders, search, onSearchChange, currency, onNewOrder, onDeleteOrder })`

- [ ] **Step 1: Create `Dashboard.jsx`**

Use `PageHeader`, `Button`, `StatCard`, `StatusBadge`, and `Icon`. Render the existing four metrics and up to six recent orders. Do not add trend percentages or historical claims.

- [ ] **Step 2: Create `Orders.jsx`**

Render a page header with new-order action, a search toolbar, and the existing orders table. Preserve current columns and deletion behavior while using the shared status and button components.

- [ ] **Step 3: Update `App.jsx`**

Replace the old dashboard/orders JSX branches with the new page components. Keep all existing state, memoized calculations, handlers, and data logic unchanged.

- [ ] **Step 4: Add page-specific styles**

Style the dashboard metric grid, recent-order cards/list, toolbar, responsive table container, table rows, and compact destructive action.

- [ ] **Step 5: Run static checks**

```bash
npm run lint
npm run build
```

Expected: both exit successfully.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.jsx src/pages/Orders.jsx src/App.jsx src/App.css
git commit -m "feat: redesign dashboard and orders"
```

---

### Task 4: Extract and Redesign Clients, Products, and Finance

**Files:**
- Create: `src/pages/Clients.jsx`
- Create: `src/pages/Products.jsx`
- Create: `src/pages/Finance.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- `Clients({ clients, search, sort, onSearchChange, onSortChange, onAdd, onEdit, onDelete })`
- `Products({ products, search, currency, onSearchChange, onAdd, onEdit, onDelete })`
- `Finance({ totals, movements, currency, onAddMovement })`

- [ ] **Step 1: Create `Clients.jsx`**

Use a common page header and toolbar. Render client rows with avatar initial, name, phone, address, and accessible edit/delete icon buttons. Remove all `android-*` naming from the rendered markup.

- [ ] **Step 2: Create `Products.jsx`**

Render category badge, product name, unit/size, price, and consistent edit/delete actions. Keep product data unchanged.

- [ ] **Step 3: Create `Finance.jsx`**

Render three metric cards for entradas, saídas, and saldo plus a movement list using restrained positive/negative styling and the existing movement data.

- [ ] **Step 4: Update `App.jsx`**

Replace the old clients/products/finance JSX branches with page components. Preserve existing handlers and memoized values.

- [ ] **Step 5: Replace legacy page styles**

Remove obsolete Android/client/product/movement presentation styles that are no longer referenced and add the new unified list/card/toolbar styles.

- [ ] **Step 6: Run static checks**

```bash
npm run lint
npm run build
```

Expected: both exit successfully.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Clients.jsx src/pages/Products.jsx src/pages/Finance.jsx src/App.jsx src/App.css
git commit -m "feat: redesign clients products and finance"
```

---

### Task 5: Standardize Modals, Forms, Toasts, and Final App Composition

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Reuse `AppShell`, `Modal`, `Button`, and `Icon` from earlier tasks.
- Existing form state objects and submit/edit/cancel handlers remain unchanged.

- [ ] **Step 1: Replace the old header/navigation in `App.jsx`**

Wrap all app content in:

```jsx
<AppShell activeTab={activeTab} onNavigate={setActiveTab}>
  {/* active page */}
</AppShell>
```

- [ ] **Step 2: Convert order modal to `Modal`**

Keep the current fields: Cliente, Tipo, Status, Produto, Quantidade, Valor unitário, Total do pedido. Use visible labels and shared form styles. Submit still calls `handleOrderSubmit`.

- [ ] **Step 3: Convert client/product/movement modals to `Modal`**

Preserve every current field and handler. Replace emoji action visuals with the shared icon component where applicable.

- [ ] **Step 4: Polish toast feedback**

Keep the current 2200ms behavior but style the toast with an icon, restrained success surface, and responsive positioning.

- [ ] **Step 5: Complete responsive CSS**

Verify desktop, tablet, and 320px mobile layouts. Ensure main content does not cause page-level horizontal scrolling; only `.table-wrap` may scroll horizontally.

- [ ] **Step 6: Add reduced-motion handling**

Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 7: Run static checks**

```bash
npm run lint
npm run build
```

Expected: both exit successfully.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/App.css
git commit -m "feat: polish forms modals and responsive UI"
```

---

### Task 6: Final Regression and Diff Review

**Files:**
- Review all changed files.

- [ ] **Step 1: Run final checks**

```bash
npm run lint
npm run build
```

Expected: both exit successfully.

- [ ] **Step 2: Verify source-level behavior preservation**

Confirm these handlers/calculations still exist and are wired to UI actions:

- `handleOrderSubmit`
- `handleNewOrder`
- `handleAddClient`
- `handleSaveClient`
- `handleDeleteClient`
- `handleAddProduct`
- `handleDeleteProduct`
- `handleAddMovement`
- `totals`
- `financialTotals`
- all four original `STORAGE_KEYS`

- [ ] **Step 3: Review the final diff**

Confirm no dependency or Cloudflare deployment files were changed and no business formulas/data shapes changed unintentionally.

- [ ] **Step 4: Final commit if cleanup was required**

```bash
git add src docs
git commit -m "chore: finalize delivery app UI redesign"
```
