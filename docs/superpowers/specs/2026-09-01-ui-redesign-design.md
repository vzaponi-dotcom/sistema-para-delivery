# UI Redesign Design — Sistema para Delivery

Date: 2026-09-01
Branch: `frontend/ui-redesign`

## Goal

Modernize the delivery management app so it feels like a polished commercial SaaS product while preserving the current business logic, localStorage persistence, and the existing React + Vite stack.

## Current State

The app currently renders Dashboard, Orders, Clients, Products, and Finance from a single large `src/App.jsx`, with most visual styling concentrated in `src/App.css`. The visual language is functional but inconsistent: some screens use Android-inspired naming/patterns, the navigation is a horizontal header, the interface relies heavily on amber/orange, and the Amor & Sabor brand logo is not integrated into the application shell.

## Chosen Approach

Use a componentized redesign without introducing a heavy UI framework. Keep React + Vite and the current data model, while creating a small reusable design system with CSS variables, shared UI components, consistent navigation, and responsive layouts.

This approach avoids the migration cost of Tailwind/shadcn while still producing a substantially more polished result.

## Visual Direction

The interface should feel:

- modern and premium
- clean and operational
- warm enough for a food/delivery brand without looking playful
- information-dense but easy to scan
- consistent across desktop and mobile

### Brand palette

Use the existing Amor & Sabor identity as the basis:

- Primary: deep brand red
- Primary hover/active: darker red
- Background: warm neutral off-white
- Surface: white
- Text: dark graphite
- Muted text: neutral gray
- Border: subtle warm gray
- Success: green
- Warning: amber
- Error/destructive: red
- Informational status: blue/purple where semantically useful

Amber should no longer be the dominant action color.

## Application Shell

### Desktop

Replace the current horizontal navigation with a professional two-column application shell:

- fixed-width left sidebar
- brand/logo at the top
- navigation items for Dashboard, Pedidos, Clientes, Produtos, Financeiro
- active state clearly visible
- main content area with page title, context text, and page-level actions

### Mobile

Use a compact responsive navigation appropriate for narrow screens. Content must reflow without horizontal page scrolling. Tables may use local horizontal scrolling only where necessary.

## Shared UI Components

Create reusable components for:

- `AppShell`
- `Sidebar`
- `PageHeader`
- `Button`
- `StatCard`
- `StatusBadge`
- `Modal`
- `Icon`
- reusable empty-state or section-header patterns as needed

Avoid unnecessary abstraction; components should exist when they remove duplication or enforce visual consistency.

## Pages

### Dashboard

Improve the visual hierarchy and operational readability:

- strong page header with “Novo pedido” primary action
- KPI cards for faturamento, pedidos, ticket médio, and unidades vendidas
- icons or compact visual markers for KPIs
- clearer supporting labels
- recent orders section with stronger hierarchy, cleaner status display, and price emphasis
- optional contextual summary using existing data only

Do not add fabricated analytics or historical trends.

### Orders

- stronger page-level hierarchy
- consistent toolbar/search control
- polished table treatment
- readable status badges
- less visually aggressive destructive actions
- responsive table wrapper
- improved modal for new orders

Business behavior remains unchanged.

### Clients

Remove the Android-specific visual inconsistency and align the page with the common design system:

- unified page header
- search and sort toolbar
- polished contact rows/cards
- consistent edit/delete icon buttons
- improved client modal

### Products

- consistent toolbar and page header
- cleaner product rows/cards
- clear category, unit/size, and price hierarchy
- consistent edit/delete controls
- improved product modal

### Finance

- KPI cards for entradas, saídas, and saldo
- semantic coloring that remains restrained
- clearer movement list
- improved “Novo movimento” modal

Do not change financial calculations in this redesign.

## Forms and Modals

Standardize all controls:

- 44px minimum comfortable touch targets where practical
- clear labels
- consistent borders, radius, spacing, and focus states
- visible keyboard focus
- hover/active/disabled states
- modal backdrop and surface consistent across all flows
- primary and secondary action hierarchy

## Motion and Feedback

Use subtle transitions only:

- hover transitions
- active navigation feedback
- modal appearance
- button press/hover feedback
- toast presentation

Respect `prefers-reduced-motion` and avoid decorative motion that slows operation.

## Accessibility

- maintain semantic HTML
- preserve or improve aria labels on icon actions
- visible keyboard focus
- sufficient color contrast
- no status communicated only by color
- mobile inputs at readable sizes

## Code Structure

Target structure:

```text
src/
  components/
    AppShell.jsx
    Sidebar.jsx
    PageHeader.jsx
    Button.jsx
    StatCard.jsx
    StatusBadge.jsx
    Modal.jsx
    Icon.jsx
    BrandLogo.jsx
  pages/
    Dashboard.jsx
    Orders.jsx
    Clients.jsx
    Products.jsx
    Finance.jsx
  App.jsx
  App.css
  index.css
```

The final exact structure may vary slightly if implementation reveals a cleaner low-complexity boundary.

## State and Data Flow

Keep the current top-level state/data logic initially in `App.jsx` to minimize regression risk. Page components receive the data and handlers they need via props.

Do not introduce global state libraries in this redesign.

Persist the existing localStorage keys and data shape unless a required bug fix is discovered and explicitly documented.

## Preview and Deployment Strategy

Production remains on `master` and should not be changed during redesign.

Work occurs on `frontend/ui-redesign`.

The repository currently has no committed Cloudflare preview/deployment configuration, so the new branch does not automatically receive a separate `workers.dev` URL. During development, the branch can be previewed locally with Vite. A public preview environment can be connected later through Cloudflare branch previews or a separate preview deployment without changing the production URL.

Do not alter production deployment configuration as part of the visual redesign unless explicitly approved.

## Validation

Before presenting the redesign as complete:

1. Run `npm run build`.
2. Run `npm run lint`.
3. Review the diff against `master` for unintended business-logic changes.
4. Check main flows: create order, create/edit client, create/edit product, create financial movement, search/filter/sort, and localStorage persistence.
5. Check responsive behavior at desktop, tablet, and small-mobile widths.

## Non-Goals

This redesign does not include:

- backend implementation
- authentication
- database migration
- payment integration
- new financial formulas
- invented analytics/history
- major changes to product behavior
- production Cloudflare deployment changes

## Success Criteria

The redesign is successful when:

- all existing primary workflows still work
- the interface looks consistent across every section
- Amor & Sabor branding is integrated coherently
- the app feels like a sellable SaaS product rather than a prototype
- desktop and mobile experiences are intentionally designed
- build and lint pass
- production `master` remains untouched until the redesign is reviewed and merged
