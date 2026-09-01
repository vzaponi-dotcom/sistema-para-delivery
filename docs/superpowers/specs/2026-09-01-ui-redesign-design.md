# UI Redesign Design — Sistema para Delivery

Date: 2026-09-01
Target branch: `master`

## Goal

Modernize the delivery management app so it feels like a polished commercial SaaS product while preserving the current business logic, localStorage persistence, and the existing React + Vite stack.

## Chosen Approach

Use a componentized redesign without introducing a heavy UI framework. Keep React + Vite and the current data model, while creating a small reusable design system with CSS variables, shared UI components, consistent navigation, and responsive layouts.

## Visual Direction

The interface should feel modern, premium, clean, operational, warm enough for a food/delivery brand without looking playful, and consistent across desktop and mobile.

Use the existing Amor & Sabor identity as the basis. Deep brand red becomes the primary action color, with warm neutral backgrounds, white surfaces, dark graphite text, subtle borders, and restrained semantic colors for success, warning, informational, and destructive states. Amber should no longer dominate the interface.

## Application Shell

Desktop uses a two-column application shell with a left sidebar containing the Amor & Sabor identity and navigation for Dashboard, Pedidos, Clientes, Produtos, and Financeiro. The main content area carries page titles, context, actions, cards, tables, and lists.

Mobile uses a compact responsive navigation and intentionally reflowed layouts. Page-level horizontal scrolling is not allowed; tables may use local horizontal scrolling when necessary.

## Shared UI Components

Create reusable components where they improve consistency or remove duplication:

- `AppShell`
- `Sidebar`
- `PageHeader`
- `Button`
- `StatCard`
- `StatusBadge`
- `Modal`
- `Icon`
- `BrandLogo`

Avoid unnecessary abstraction.

## Page Requirements

### Dashboard

- strong page header and `Novo pedido` primary action
- polished KPI cards for faturamento, pedidos, ticket médio, and unidades vendidas
- visually consistent metric icons/markers
- recent orders with clear status and value hierarchy
- no fabricated analytics or trends

### Orders

- consistent page header and toolbar
- polished responsive table
- readable status badges
- restrained destructive actions
- improved new-order modal

### Clients

- remove Android-specific visual inconsistency
- consistent search/sort toolbar
- polished client rows/cards
- consistent edit/delete actions
- improved client modal

### Products

- consistent toolbar and page header
- clear category, unit/size, product, and price hierarchy
- polished product rows
- improved product modal

### Finance

- KPI cards for entradas, saídas, and saldo
- restrained semantic coloring
- clearer movement list
- improved movement modal
- financial formulas remain unchanged

## Forms, Motion, Accessibility

All controls use consistent borders, radius, spacing, focus, hover, active, and disabled states. Touch targets should be comfortable, with mobile inputs at readable sizes. Keep transitions subtle and respect `prefers-reduced-motion`.

Preserve semantic HTML, aria labels, visible keyboard focus, adequate contrast, and text labels in addition to color for statuses.

## State and Data Flow

Keep current state and business logic at the top level initially and pass required data/handlers into page components via props. Do not introduce a global state library. Preserve existing localStorage keys and data shapes unless an explicit bug must be fixed.

## Deployment Strategy

This project is currently a test application. The redesign will be implemented directly on the repository's default branch, `master`, so the existing deployment can be used as the live test environment. No production-safety branch workflow is required for this phase.

Do not add or modify Cloudflare deployment configuration unless separately required.

## Validation

Before completion:

1. Run `npm run build`.
2. Run `npm run lint`.
3. Review the diff for unintended business-logic changes.
4. Validate the main flows: create order, create/edit client, create/edit product, create financial movement, search/filter/sort, and localStorage persistence.
5. Check responsive behavior at desktop, tablet, and small-mobile widths.

## Non-Goals

- backend implementation
- authentication
- database migration
- payment integration
- new financial formulas
- fabricated analytics/history
- major changes to product behavior
- Cloudflare deployment reconfiguration

## Success Criteria

The redesign is successful when all existing primary workflows still work, the interface looks consistent across all sections, Amor & Sabor branding is integrated coherently, desktop/mobile feel intentionally designed, and build/lint pass.
