# Dashboard analytics redesign — design

Date: 2026-09-02
Status: approved design, pending implementation plan

## Goal

Reformulate the Dashboard so it serves two purposes at the same time:

1. show the current operational state of the delivery business; and
2. help the owner understand short-term business performance through simple, useful visualizations.

The new Dashboard must stay lightweight, mobile-friendly, compatible with the existing light/dark themes, and understandable without turning the product into a complex BI tool.

## Scope

This redesign changes the Dashboard presentation and client-side analytics only.

In scope:

- retain the current operational summary;
- add an analytics period selector with `Hoje`, `7 dias`, and `30 dias`;
- use `30 dias` as the default analytics period;
- add period KPIs for sales, order count, and average ticket;
- add charts for sales by day, orders by day, Top 5 products, and payment-method mix;
- retain recent orders at the bottom of the Dashboard;
- add one global eye control that temporarily hides monetary values across the Dashboard;
- calculate analytics from the already-loaded order data;
- add client-side helpers and tests for all analytics rules.

Out of scope for this version:

- new database tables or migrations;
- new API or Worker analytics endpoints;
- persisted dashboard filter preferences;
- persisted privacy/visibility preference;
- customer analytics such as top customers or new-customer trends;
- forecasting, goals, budgets, comparisons against previous periods, or advanced BI features;
- adding a third-party charting library.

## Current state

The current Dashboard shows:

- Vendas hoje;
- Recebido hoje;
- A receber;
- Pedidos ativos;
- the six most recent orders;
- the `Novo pedido` action.

This is useful for the current operation but offers little trend or commercial analysis.

The application already loads orders and their items into client state, so the first analytics version can derive all required information locally without changing the backend.

## Information architecture

The Dashboard will be organized in five sections, in this order.

### 1. Operational summary

Keep the four current cards and the `Novo pedido` action:

- Vendas hoje;
- Recebido hoje;
- A receber;
- Pedidos ativos.

These cards always represent the current operational state and are not affected by the analytics period selector.

A single eye button will live in the Dashboard header/summary area and control monetary visibility across the entire Dashboard.

### 2. Period performance

Add a compact segmented selector:

- Hoje;
- 7 dias;
- 30 dias.

Default: `30 dias`.

The selected period controls every KPI and chart in the analytics area.

Show three analytics KPIs:

- Vendas no período;
- Pedidos no período;
- Ticket médio.

### 3. Main trend charts

Show:

- Vendas por dia;
- Pedidos por dia.

On wider screens, charts may share a two-column layout when space allows. On mobile, they stack vertically.

### 4. Commercial analysis

Show:

- Top 5 produtos mais vendidos;
- Formas de pagamento.

The Top 5 is ranked by units sold, not revenue.

The payment-method visualization groups the monetary amount actually received by payment method and includes paid orders only.

### 5. Recent operation

Keep the current recent-orders list at the bottom of the page.

It remains useful for operational context but no longer occupies the primary analytical area.

## Analytics period rules

All date comparisons must use the same local-date semantics already used by the application.

Period definitions:

- `Hoje`: current local calendar date only;
- `7 dias`: current local date plus the previous 6 local calendar dates;
- `30 dias`: current local date plus the previous 29 local calendar dates.

The ranges are inclusive of today.

The selected analytics period is always applied using `order.orderDate`. This includes the payment-method analysis: it examines paid orders whose order date falls inside the selected period. `paidAt` does not determine whether an order belongs to an analytics period in this Dashboard version.

For day-series charts, every date in the selected range must be present. Days with no sales or orders must appear with zero rather than being omitted.

## Metric definitions

### Vendas hoje

Existing operational rule remains unchanged: sum `order.total` for orders whose `orderDate` is today.

Payment status does not change whether an order counts as a sale.

### Recebido hoje

Existing operational rule remains unchanged: sum payments confirmed today according to the current payment workflow.

### A receber

Existing operational rule remains unchanged: sum the pending amount for unpaid orders.

### Pedidos ativos

Existing operational rule remains unchanged: count orders not considered finished by the current workflow helper.

### Vendas no período

Sum `order.total` for all orders whose `orderDate` belongs to the selected analytics period.

An unpaid order still counts as a sale because this metric represents sales generated, not cash received.

### Pedidos no período

Count orders whose `orderDate` belongs to the selected analytics period.

### Ticket médio

`Vendas no período / Pedidos no período`.

When the period contains zero orders, ticket médio is zero and must never render `NaN` or `Infinity`.

### Vendas por dia

For each local date in the selected period, sum `order.total` for orders created on that date.

The visual is a lightweight line chart.

### Pedidos por dia

For each local date in the selected period, count orders created on that date.

The visual may use bars because the purpose is discrete daily volume comparison.

### Top 5 produtos mais vendidos

Aggregate all order items from orders in the selected period and sum item quantities.

Use a stable product identifier when the order item provides one. For legacy rows without a stable identifier, use the existing compatible display label as the grouping fallback.

Rank descending by total units sold and show at most five products.

The chart uses units, not revenue.

If fewer than five products were sold, show only those available.

### Formas de pagamento

Start from orders whose `orderDate` belongs to the selected period, then consider only those that are paid.

Group by `paymentMethod` and sum the confirmed paid amount (`paidAmount`, falling back to the order total only where the current compatibility rules require it).

Pending orders do not belong to a payment-method category.

This chart analyzes the payment-method composition of sales/orders from the selected order-date period. It is not a cash-receipt-by-`paidAt` report; `Recebido hoje` remains the operational cash-receipt indicator.

The visualization communicates part-to-whole composition. It may use a compact proportional/bar or donut-like SVG treatment, provided it remains readable on mobile and accessible without hover.

## Monetary privacy control

The Dashboard has one global eye control, similar to banking apps.

### Default behavior

Whenever a newly mounted Dashboard is opened, monetary values start visible. This includes a fresh page load/reload and any app navigation that unmounts and later reopens the Dashboard.

The visibility preference is not written to local storage, session storage, cookies, the backend, or any other persistence layer.

It is only local React state for the currently mounted Dashboard.

### Visible mode

All monetary values render normally.

### Hidden mode

Replace explicit monetary values with a neutral mask such as `••••••` while keeping labels and layout stable.

The control applies to all monetary information shown on the Dashboard, including:

- Vendas hoje;
- Recebido hoje;
- A receber;
- Vendas no período;
- Ticket médio;
- monetary labels/tooltips/axis values in Vendas por dia;
- monetary values in Formas de pagamento;
- monetary totals shown in recent-order rows.

Non-monetary information remains visible, including:

- Pedidos ativos;
- Pedidos no período;
- Pedidos por dia;
- Top 5 product quantities;
- dates, names, statuses, payment-method labels, and chart shapes.

For monetary charts, hiding values must not remove the chart geometry. The user can still perceive relative trend/composition without seeing exact currency values.

The eye button must expose an accessible label that changes with state, for example `Ocultar valores` / `Mostrar valores`.

## Chart implementation approach

Do not add a third-party chart dependency in this version.

Build small reusable presentation components using SVG and CSS, with the existing theme variables and responsive patterns.

Suggested component boundaries:

- `DashboardPeriodSelector` — owns only the segmented period UI;
- `DashboardLineChart` — renders a simple responsive line series;
- `DashboardBarChart` — renders vertical/horizontal bars for counts/rankings;
- `DashboardPaymentMix` — renders the compact payment composition view;
- `DashboardMetricCard` or existing `StatCard` extension — presents period KPIs without duplicating card styling.

The exact filenames can change during implementation if existing component conventions make another split clearer, but `Dashboard.jsx` should not contain all data aggregation and SVG math inline.

## Analytics helpers

Create a focused client-side analytics module, for example `src/utils/dashboardAnalytics.js`.

It should provide pure functions for:

- resolving the inclusive local-date range for `today`, `7d`, and `30d`;
- filtering orders by selected period;
- computing period sales, order count, and average ticket;
- generating daily series with zero-filled dates;
- aggregating Top 5 products by quantity;
- aggregating paid amounts by payment method.

Pure helpers keep the calculations testable independently from React rendering.

`Dashboard.jsx` should use `useMemo` where useful so analytics are recomputed only when orders or the selected period change.

## Data flow

1. `App.jsx` continues loading business data through the existing bootstrap flow.
2. `Dashboard` continues receiving `orders`, current operational `totals`, `currency`, and `onNewOrder`.
3. No new network request is triggered by the Dashboard period selector.
4. Dashboard local state stores:
   - selected analytics period, initialized to `30d`;
   - monetary visibility, initialized to `true` each time the Dashboard mounts.
5. Pure analytics helpers derive period metrics and chart series from `orders`.
6. Presentation components receive already-derived data and render it.

The implementation may move some operational total calculations into shared helpers only if that directly reduces duplication needed by this redesign. Unrelated refactoring is not part of the scope.

## Empty and edge states

The Dashboard must remain useful with no data.

Rules:

- zero orders in a period => sales `R$ 0,00`, orders `0`, average ticket `R$ 0,00`;
- daily chart data always contains every selected date, with zero for missing days;
- if an entire daily series is zero, the UI may additionally show a concise friendly message, but it must preserve the zero-filled series semantics rather than dropping dates from the analytics data;
- Top 5 displays a friendly no-sales message if there are no product items in the period;
- payment mix displays a friendly no-payments message if there are no paid orders in the period;
- malformed optional legacy fields must use the same compatibility fallbacks already used elsewhere in the app;
- no chart may render `NaN`, `Infinity`, `undefined`, or break layout because of an empty dataset.

## Responsive behavior

Mobile is a first-class layout.

At narrow widths:

- all analytics sections stack into one column;
- the period selector remains tappable without horizontal page scrolling;
- chart labels remain readable;
- Top 5 product names wrap instead of clipping;
- the global eye control keeps an approximately 44px touch target;
- monetary masks should occupy roughly similar space to values to minimize layout jumps.

On wider screens:

- related chart cards can form two-column groups;
- the sales trend may receive more horizontal space than secondary summaries when that improves readability.

The existing light/dark theme tokens must be used. No chart should rely on hard-coded colors that fail in one theme.

## Accessibility and interaction

- Period controls use native buttons with clear selected state and `aria-pressed` or equivalent semantics.
- The eye control is a button, not a clickable decorative icon.
- Charts cannot rely on hover as the only way to understand values; visible labels or tap/focus-friendly details must exist where exact values are needed.
- SVGs need useful accessible names/descriptions or surrounding textual summaries.
- Hidden monetary values must not remain exposed in accessibility-only labels while visual privacy mode is active.

## Testing strategy

Implementation follows TDD.

### Analytics unit tests

Cover at minimum:

- `Hoje` includes only today;
- `7 dias` includes today plus six previous local dates;
- `30 dias` includes today plus twenty-nine previous local dates;
- period filtering is inclusive at both ends;
- payment-method period membership is based on `orderDate`, not `paidAt`;
- sales count unpaid and paid orders alike;
- average ticket uses sales divided by order count;
- average ticket is zero with no orders;
- daily sales series includes every date and zero-fills missing days;
- daily order series includes every date and zero-fills missing days;
- Top 5 aggregates repeated items and quantities correctly;
- Top 5 sorts descending and limits to five;
- payment mix ignores pending orders;
- payment mix groups paid amounts by payment method;
- compatibility fallback for paid amount works as intended.

### Dashboard UI tests

Cover at minimum:

- the operational summary remains present;
- analytics defaults to `30 dias`;
- selecting Hoje/7 dias/30 dias changes the derived analytics content;
- all four approved visualizations are present;
- global eye control starts visible on each Dashboard mount;
- global eye control hides monetary KPI values and recent-order monetary values;
- non-monetary counts remain visible when privacy is enabled;
- monetary chart labels/details are hidden while chart geometry remains rendered;
- privacy initialization does not read a persisted preference;
- empty datasets render friendly states without dropping zero-filled dates from analytics data.

### Full validation

Before integration:

- `npm test`;
- `npm run lint`;
- `npm run build`;
- Wrangler production bundle dry-run using the repository's existing validation workflow.

## Backend and persistence impact

None expected.

This version requires:

- no D1 migration;
- no Worker repository changes;
- no API contract changes;
- no new secrets;
- no new persistent user preference.

If implementation discovers that the bootstrap does not contain enough historical order-item/payment data to satisfy the approved metrics correctly, stop and upgrade the design before adding an analytics endpoint. Do not silently change the architecture.

## Acceptance criteria

The redesign is complete when:

1. The Dashboard still provides the current-day operational summary and `Novo pedido` action.
2. The analytics area defaults to 30 days and supports Hoje, 7 dias, and 30 dias.
3. The selected analytics period simultaneously controls sales, order count, average ticket, sales/day, orders/day, Top 5 products, and payment methods using `orderDate` membership.
4. Sales metrics count orders by order date regardless of whether payment is pending.
5. Payment-method analysis includes paid orders only, groups confirmed monetary amounts, and does not use `paidAt` to decide period membership.
6. Daily charts include zero-value dates instead of skipping them.
7. One global eye control hides every explicit monetary value on the Dashboard while preserving non-monetary operational information and chart geometry.
8. Monetary visibility starts visible every time the Dashboard mounts and is never persisted.
9. The Dashboard remains readable and usable on mobile and in both light and dark themes.
10. No backend, D1, or API change is introduced unless a discovered data gap forces a new design review.
11. The approved analytics and privacy behavior are covered by automated tests and the full application validation passes before integration.
