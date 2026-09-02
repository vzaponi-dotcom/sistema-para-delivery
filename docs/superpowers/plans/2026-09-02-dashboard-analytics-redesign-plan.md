# Dashboard Analytics Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic Dashboard with a mobile-friendly operational + analytical view that supports Hoje / 7 dias / 30 dias, lightweight charts, Top 5 products, payment-method mix, average ticket, and one global temporary monetary-privacy control.

**Architecture:** Keep the existing bootstrap/API flow unchanged and derive analytics entirely from the already-loaded `orders` array. Put date/aggregation logic in a pure `dashboardAnalytics.js` module, keep chart rendering in small SVG/CSS components, and let `Dashboard.jsx` own only the selected period and temporary monetary-visibility state. Reuse existing `StatCard`, `PageHeader`, status/payment badges, currency formatter, theme variables, and recent-order markup.

**Tech Stack:** React 19.2.8, JavaScript ES modules, Vite 8.2.2, Node `node:test`, CSS/SVG, oxlint, Wrangler 4.128.0. No third-party chart library.

**Spec:** `docs/superpowers/specs/2026-09-02-dashboard-analytics-redesign-design.md`

## Global Constraints

- The operational cards remain `Vendas hoje`, `Recebido hoje`, `A receber`, and `Pedidos ativos`, and they are not affected by the analytics period selector.
- Analytics periods are `Hoje`, `7 dias`, and `30 dias`; the default is `30 dias`.
- Period ranges are local-calendar-date ranges, inclusive of today: 1, 7, and 30 dates respectively.
- Sales analytics are based on `order.orderDate` regardless of payment status.
- Payment-method analytics include paid orders only, are selected by `order.orderDate`, and group confirmed paid amount by payment method.
- Daily series must include every date in the selected range, including zero-value dates.
- Top 5 products rank by units sold, not revenue.
- One global eye control hides explicit monetary values across the Dashboard but leaves counts, labels, statuses, dates, and chart geometry visible.
- Monetary visibility starts `true` every time `Dashboard` mounts and is never persisted to localStorage, sessionStorage, cookies, API, or D1.
- Do not add a charting dependency. Use React + SVG/CSS and existing theme tokens.
- Do not change Worker routes, API contracts, D1 migrations, secrets, or persistence for this feature.
- Mobile is first-class: no page-level horizontal scrolling; controls must remain tap-friendly; charts stack on narrow screens.
- Hidden monetary values must not leak through accessibility-only text or SVG labels.
- Follow TDD for each task: write the failing test, verify RED, implement the minimum change, verify GREEN, review, then commit.
- At execution start, create `feature/dashboard-analytics-redesign` from the approved design/plan branch head so the spec and plan travel with the implementation.

---

### Task 1: Pure dashboard analytics helpers

**Files:**
- Create: `src/utils/dashboardAnalytics.js`
- Create: `src/utils/dashboardAnalytics.test.js`
- Read/Reuse: `src/utils/orderCart.js`
- Read/Reuse: `src/utils/orderWorkflow.js`
- Read/Reuse: `src/utils/paymentWorkflow.js`

**Interfaces:**
- Consumes: `getOrderItems(order)`, `getOrderItemDisplayName(item)`, `toLocalDateValue(date)`, and `isOrderPaid(order)`.
- Produces:
  - `getDashboardDateRange(period, now?) -> string[]` ordered oldest to newest.
  - `filterOrdersByPeriod(orders, period, now?) -> Order[]`.
  - `calculatePeriodMetrics(orders, period, now?) -> { sales: number, orderCount: number, averageTicket: number }`.
  - `buildDailySeries(orders, period, now?) -> Array<{ date: string, label: string, sales: number, orders: number }>`.
  - `getTopProducts(orders, period, now?, limit?) -> Array<{ key: string, label: string, quantity: number }>`.
  - `getPaymentMix(orders, period, now?) -> Array<{ method: string, amount: number }>`.

- [ ] **Step 1: Write the failing analytics tests**

Create `src/utils/dashboardAnalytics.test.js` with deterministic local dates and fixtures:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDailySeries,
  calculatePeriodMetrics,
  filterOrdersByPeriod,
  getDashboardDateRange,
  getPaymentMix,
  getTopProducts,
} from './dashboardAnalytics.js'

const now = new Date(2026, 8, 2, 12, 0, 0)

const makeOrder = (overrides = {}) => ({
  id: overrides.id ?? crypto.randomUUID(),
  client: 'Cliente',
  orderDate: '2026-09-02',
  total: 0,
  paymentStatus: 'Pendente',
  paymentMethod: null,
  paidAmount: 0,
  items: [],
  ...overrides,
})

test('dashboard date ranges are inclusive and zero-padded in local time', () => {
  assert.deepEqual(getDashboardDateRange('today', now), ['2026-09-02'])
  assert.deepEqual(getDashboardDateRange('7d', now), [
    '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30',
    '2026-08-31', '2026-09-01', '2026-09-02',
  ])
  const thirty = getDashboardDateRange('30d', now)
  assert.equal(thirty.length, 30)
  assert.equal(thirty[0], '2026-08-04')
  assert.equal(thirty.at(-1), '2026-09-02')
})

test('period filtering and sales include paid and unpaid orders by order date', () => {
  const orders = [
    makeOrder({ id: 'today-paid', orderDate: '2026-09-02', total: 50, paymentStatus: 'Pago' }),
    makeOrder({ id: 'yesterday-pending', orderDate: '2026-09-01', total: 30 }),
    makeOrder({ id: 'week-paid', orderDate: '2026-08-28', total: 20, paymentStatus: 'Pago' }),
    makeOrder({ id: 'outside', orderDate: '2026-08-03', total: 999 }),
  ]

  assert.deepEqual(filterOrdersByPeriod(orders, '7d', now).map((order) => order.id), [
    'today-paid', 'yesterday-pending', 'week-paid',
  ])
  assert.deepEqual(calculatePeriodMetrics(orders, '7d', now), {
    sales: 100,
    orderCount: 3,
    averageTicket: 100 / 3,
  })
  assert.deepEqual(calculatePeriodMetrics([], '7d', now), {
    sales: 0,
    orderCount: 0,
    averageTicket: 0,
  })
})

test('daily series keeps every selected day and zero-fills missing dates', () => {
  const series = buildDailySeries([
    makeOrder({ orderDate: '2026-09-02', total: 50 }),
    makeOrder({ orderDate: '2026-09-02', total: 25 }),
    makeOrder({ orderDate: '2026-08-28', total: 20 }),
  ], '7d', now)

  assert.equal(series.length, 7)
  assert.deepEqual(series.find((row) => row.date === '2026-09-02'), {
    date: '2026-09-02', label: '02/09', sales: 75, orders: 2,
  })
  assert.deepEqual(series.find((row) => row.date === '2026-08-29'), {
    date: '2026-08-29', label: '29/08', sales: 0, orders: 0,
  })
})

test('top products aggregate repeated product identities, sum quantities, sort, and limit to five', () => {
  const orders = [makeOrder({
    orderDate: '2026-09-02',
    items: [
      { productId: 'p1', name: 'Marmita', size: 'P', quantity: 3 },
      { productId: 'p2', name: 'Marmita', size: 'M', quantity: 4 },
      { productId: 'p3', name: 'Suco', size: '500ml', quantity: 2 },
      { productId: 'p4', name: 'Sobremesa', size: 'Un', quantity: 1 },
      { productId: 'p5', name: 'Água', size: '500ml', quantity: 1 },
      { productId: 'p6', name: 'Café', size: 'Un', quantity: 1 },
    ],
  }), makeOrder({
    orderDate: '2026-09-01',
    items: [{ productId: 'p1', name: 'Marmita', size: 'P', quantity: 3 }],
  })]

  const top = getTopProducts(orders, '7d', now)
  assert.equal(top.length, 5)
  assert.deepEqual(top.slice(0, 3).map(({ label, quantity }) => ({ label, quantity })), [
    { label: 'Marmita P', quantity: 6 },
    { label: 'Marmita M', quantity: 4 },
    { label: 'Suco 500ml', quantity: 2 },
  ])
})

test('payment mix uses paid orders only, groups by method, and falls back to total', () => {
  const orders = [
    makeOrder({ orderDate: '2026-09-02', total: 50, paymentStatus: 'Pago', paymentMethod: 'Pix', paidAmount: 50, paidAt: '2026-08-20T12:00:00.000Z' }),
    makeOrder({ orderDate: '2026-09-01', total: 25, paymentStatus: 'Pago', paymentMethod: 'Pix', paidAmount: null }),
    makeOrder({ orderDate: '2026-08-28', total: 20, paymentStatus: 'Pago', paymentMethod: 'Dinheiro', paidAmount: 20 }),
    makeOrder({ orderDate: '2026-09-02', total: 40, paymentStatus: 'Pendente', paymentMethod: 'Pix' }),
    makeOrder({ orderDate: '2026-08-03', total: 80, paymentStatus: 'Pago', paymentMethod: 'Cartão de crédito', paidAmount: 80 }),
  ]

  assert.deepEqual(getPaymentMix(orders, '7d', now), [
    { method: 'Pix', amount: 75 },
    { method: 'Dinheiro', amount: 20 },
  ])
})
```

- [ ] **Step 2: Run only the new test file to verify RED**

Run:

```bash
node --test src/utils/dashboardAnalytics.test.js
```

Expected: FAIL because `src/utils/dashboardAnalytics.js` does not exist yet.

- [ ] **Step 3: Implement the pure analytics module**

Create `src/utils/dashboardAnalytics.js`:

```js
import { getOrderItemDisplayName, getOrderItems } from './orderCart.js'
import { toLocalDateValue } from './orderWorkflow.js'
import { isOrderPaid } from './paymentWorkflow.js'

const PERIOD_DAYS = { today: 1, '7d': 7, '30d': 30 }
const safeMoney = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}
const safeQuantity = (value) => Math.max(1, Math.trunc(Number(value) || 1))
const localNoon = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0)
const dateLabel = (dateValue) => {
  const [, month, day] = String(dateValue).split('-')
  return `${day}/${month}`
}

export const getDashboardDateRange = (period = '30d', now = new Date()) => {
  const days = PERIOD_DAYS[period] ?? PERIOD_DAYS['30d']
  const end = localNoon(now instanceof Date ? now : new Date(now))

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setDate(end.getDate() - (days - 1 - index))
    return toLocalDateValue(date)
  })
}

export const filterOrdersByPeriod = (orders, period = '30d', now = new Date()) => {
  const dates = new Set(getDashboardDateRange(period, now))
  return (Array.isArray(orders) ? orders : []).filter((order) => dates.has(order?.orderDate))
}

export const calculatePeriodMetrics = (orders, period = '30d', now = new Date()) => {
  const selected = filterOrdersByPeriod(orders, period, now)
  const sales = selected.reduce((sum, order) => sum + safeMoney(order?.total), 0)
  const orderCount = selected.length

  return {
    sales,
    orderCount,
    averageTicket: orderCount ? sales / orderCount : 0,
  }
}

export const buildDailySeries = (orders, period = '30d', now = new Date()) => {
  const dates = getDashboardDateRange(period, now)
  const selected = filterOrdersByPeriod(orders, period, now)
  const grouped = new Map(dates.map((date) => [date, { sales: 0, orders: 0 }]))

  for (const order of selected) {
    const bucket = grouped.get(order.orderDate)
    if (!bucket) continue
    bucket.sales += safeMoney(order.total)
    bucket.orders += 1
  }

  return dates.map((date) => ({
    date,
    label: dateLabel(date),
    sales: grouped.get(date).sales,
    orders: grouped.get(date).orders,
  }))
}

export const getTopProducts = (orders, period = '30d', now = new Date(), limit = 5) => {
  const grouped = new Map()

  for (const order of filterOrdersByPeriod(orders, period, now)) {
    for (const item of getOrderItems(order)) {
      const label = getOrderItemDisplayName(item)
      const key = item.productId ? `id:${item.productId}` : `label:${label.toLocaleLowerCase('pt-BR')}`
      const current = grouped.get(key) ?? { key, label, quantity: 0 }
      current.quantity += safeQuantity(item.quantity)
      grouped.set(key, current)
    }
  }

  return [...grouped.values()]
    .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label, 'pt-BR'))
    .slice(0, Math.max(0, Math.trunc(Number(limit) || 0)))
}

export const getPaymentMix = (orders, period = '30d', now = new Date()) => {
  const grouped = new Map()

  for (const order of filterOrdersByPeriod(orders, period, now)) {
    if (!isOrderPaid(order)) continue
    const method = order.paymentMethod || 'Não informado'
    const amount = safeMoney(order.paidAmount) || safeMoney(order.total)
    grouped.set(method, (grouped.get(method) ?? 0) + amount)
  }

  return [...grouped.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount || a.method.localeCompare(b.method, 'pt-BR'))
}
```

- [ ] **Step 4: Run the analytics tests to verify GREEN**

Run:

```bash
node --test src/utils/dashboardAnalytics.test.js
```

Expected: all new analytics tests PASS.

- [ ] **Step 5: Run the existing utility tests that this module depends on**

Run:

```bash
node --test src/utils/orderCart.test.js src/utils/orderWorkflow.test.js src/utils/paymentWorkflow.test.js src/utils/dashboardAnalytics.test.js
```

Expected: PASS with zero failures.

- [ ] **Step 6: Review the task diff for scope and commit**

Verify that only the two new analytics files changed, then commit:

```bash
git add src/utils/dashboardAnalytics.js src/utils/dashboardAnalytics.test.js
git commit -m "feat: add dashboard analytics helpers"
```

---

### Task 2: Period selector and global privacy icon primitives

**Files:**
- Create: `src/components/DashboardPeriodSelector.jsx`
- Create: `src/dashboardControls.test.js`
- Modify: `src/components/Icon.jsx`

**Interfaces:**
- Consumes: existing `Icon` component conventions and native buttons.
- Produces:
  - `<DashboardPeriodSelector value="30d" onChange={(next) => ...} />`.
  - `Icon` names `eye` and `eye-off` for the Dashboard privacy toggle.

- [ ] **Step 1: Write the failing UI-source test**

Create `src/dashboardControls.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard period selector exposes Hoje 7 dias and 30 dias as pressed buttons', () => {
  const selector = source('./components/DashboardPeriodSelector.jsx')

  assert.match(selector, /Hoje/)
  assert.match(selector, /7 dias/)
  assert.match(selector, /30 dias/)
  assert.match(selector, /aria-pressed=\{value === option\.value\}/)
  assert.match(selector, /onClick=\{\(\) => onChange\(option\.value\)\}/)
  assert.match(selector, /aria-label="Período da análise"/)
})

test('icon set includes visible and hidden eye icons', () => {
  const icon = source('./components/Icon.jsx')

  assert.match(icon, /eye:/)
  assert.match(icon, /['"]eye-off['"]:/)
})
```

- [ ] **Step 2: Run the new test to verify RED**

Run:

```bash
node --test src/dashboardControls.test.js
```

Expected: FAIL because the selector file and eye icons do not exist.

- [ ] **Step 3: Add the two eye icons**

In `src/components/Icon.jsx`, add these entries inside the existing `icons` object:

```jsx
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  'eye-off': <><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a15.5 15.5 0 0 1-2.1 3.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.2-1"/></>,
```

Do not change the `Icon` public API.

- [ ] **Step 4: Add the segmented period selector**

Create `src/components/DashboardPeriodSelector.jsx`:

```jsx
const OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
]

function DashboardPeriodSelector({ value, onChange }) {
  return (
    <div className="dashboard-period-selector" role="group" aria-label="Período da análise">
      {OPTIONS.map((option) => (
        <button
          type="button"
          className={`dashboard-period-option${value === option.value ? ' active' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          key={option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default DashboardPeriodSelector
```

- [ ] **Step 5: Re-run the control test to verify GREEN**

Run:

```bash
node --test src/dashboardControls.test.js
```

Expected: PASS.

- [ ] **Step 6: Run lint on the repository and commit**

Run:

```bash
npm run lint
```

Expected: zero warnings and zero errors.

Commit:

```bash
git add src/components/Icon.jsx src/components/DashboardPeriodSelector.jsx src/dashboardControls.test.js
git commit -m "feat: add dashboard period and privacy controls"
```

---

### Task 3: Lightweight reusable chart components

**Files:**
- Create: `src/components/DashboardLineChart.jsx`
- Create: `src/components/DashboardBarChart.jsx`
- Create: `src/components/DashboardPaymentMix.jsx`
- Create: `src/dashboardCharts.test.js`

**Interfaces:**
- Consumes: plain derived arrays from `dashboardAnalytics.js`; formatter functions supplied by `Dashboard.jsx`.
- Produces:
  - `<DashboardLineChart data valueKey labelKey formatValue valuesVisible ariaLabel />` for sales/day.
  - `<DashboardBarChart data valueKey labelKey formatValue orientation ariaLabel />` for orders/day and Top 5.
  - `<DashboardPaymentMix data formatValue valuesVisible ariaLabel />` for paid amount by payment method.
- Privacy rule: line/payment components must never put exact monetary values in visible text or accessibility labels when `valuesVisible === false`; geometry remains rendered.

- [ ] **Step 1: Write a failing source-structure test for the chart contract**

Create `src/dashboardCharts.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard charts are local SVG/CSS components without a chart dependency', () => {
  const line = source('./components/DashboardLineChart.jsx')
  const bar = source('./components/DashboardBarChart.jsx')
  const payment = source('./components/DashboardPaymentMix.jsx')
  const combined = `${line}\n${bar}\n${payment}`

  assert.match(line, /<svg/)
  assert.match(line, /role="img"/)
  assert.match(line, /valuesVisible/)
  assert.match(bar, /orientation === ['"]horizontal['"]/)
  assert.match(bar, /<svg/)
  assert.match(payment, /dashboard-payment-segment/)
  assert.match(payment, /valuesVisible/)
  assert.doesNotMatch(combined, /recharts|chart\.js|highcharts|from ['"]d3/)
})

test('monetary chart accessibility copy changes when values are hidden', () => {
  const line = source('./components/DashboardLineChart.jsx')
  const payment = source('./components/DashboardPaymentMix.jsx')

  assert.match(line, /Valores ocultos/)
  assert.match(payment, /Valores ocultos/)
})
```

- [ ] **Step 2: Run the chart test to verify RED**

Run:

```bash
node --test src/dashboardCharts.test.js
```

Expected: FAIL because the three chart components do not exist.

- [ ] **Step 3: Implement the responsive line chart**

Create `src/components/DashboardLineChart.jsx`:

```jsx
const WIDTH = 640
const HEIGHT = 220
const LEFT = 64
const RIGHT = 18
const TOP = 18
const BOTTOM = 34
const MASK = '••••'

const safeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

const xTickIndexes = (length) => {
  if (length <= 1) return new Set([0])
  return new Set([0, Math.round((length - 1) / 4), Math.round((length - 1) / 2), Math.round((length - 1) * 3 / 4), length - 1])
}

function DashboardLineChart({
  data = [],
  valueKey = 'value',
  labelKey = 'label',
  formatValue = (value) => String(value),
  valuesVisible = true,
  ariaLabel = 'Gráfico de linha',
}) {
  const values = data.map((row) => safeNumber(row?.[valueKey]))
  const maxValue = Math.max(0, ...values)
  const scaleMax = maxValue || 1
  const plotWidth = WIDTH - LEFT - RIGHT
  const plotHeight = HEIGHT - TOP - BOTTOM
  const x = (index) => data.length <= 1 ? LEFT + plotWidth / 2 : LEFT + index * plotWidth / (data.length - 1)
  const y = (value) => TOP + plotHeight - safeNumber(value) * plotHeight / scaleMax
  const points = data.map((row, index) => `${x(index)},${y(row?.[valueKey])}`).join(' ')
  const ticks = xTickIndexes(data.length)
  const accessibleLabel = valuesVisible ? ariaLabel : `${ariaLabel}. Valores ocultos.`

  return (
    <div className="dashboard-chart dashboard-line-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={accessibleLabel} preserveAspectRatio="xMidYMid meet">
        {[1, 0.5, 0].map((ratio) => {
          const tickY = TOP + plotHeight * (1 - ratio)
          return (
            <g key={ratio}>
              <line className="dashboard-chart-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={tickY} y2={tickY} />
              <text className="dashboard-chart-axis" x={LEFT - 8} y={tickY + 4} textAnchor="end">
                {valuesVisible ? formatValue(maxValue * ratio) : MASK}
              </text>
            </g>
          )
        })}
        <polyline className="dashboard-line-path" fill="none" points={points} />
        {data.map((row, index) => <circle className="dashboard-line-point" cx={x(index)} cy={y(row?.[valueKey])} r="3.5" key={row.date ?? index} />)}
        {data.map((row, index) => ticks.has(index) ? (
          <text className="dashboard-chart-axis dashboard-chart-x-label" x={x(index)} y={HEIGHT - 8} textAnchor="middle" key={`label-${row.date ?? index}`}>
            {row?.[labelKey]}
          </text>
        ) : null)}
      </svg>
    </div>
  )
}

export default DashboardLineChart
```

- [ ] **Step 4: Implement the count/ranking bar chart**

Create `src/components/DashboardBarChart.jsx`:

```jsx
const WIDTH = 640
const HEIGHT = 220
const LEFT = 48
const RIGHT = 18
const TOP = 18
const BOTTOM = 34

const safeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

const xTickIndexes = (length) => {
  if (length <= 1) return new Set([0])
  return new Set([0, Math.round((length - 1) / 4), Math.round((length - 1) / 2), Math.round((length - 1) * 3 / 4), length - 1])
}

function DashboardBarChart({
  data = [],
  valueKey = 'value',
  labelKey = 'label',
  formatValue = (value) => String(value),
  orientation = 'vertical',
  ariaLabel = 'Gráfico de barras',
}) {
  const maxValue = Math.max(0, ...data.map((row) => safeNumber(row?.[valueKey])))
  const scaleMax = maxValue || 1

  if (orientation === 'horizontal') {
    if (!data.length) return <div className="dashboard-chart-empty">Nenhum produto vendido no período.</div>

    return (
      <div className="dashboard-horizontal-bars" role="img" aria-label={ariaLabel}>
        {data.map((row, index) => {
          const value = safeNumber(row?.[valueKey])
          const width = `${Math.max(0, value * 100 / scaleMax)}%`
          return (
            <div className="dashboard-horizontal-bar-row" key={row.key ?? row?.[labelKey] ?? index}>
              <div className="dashboard-horizontal-bar-copy"><span>{row?.[labelKey]}</span><strong>{formatValue(value)}</strong></div>
              <div className="dashboard-horizontal-bar-track" aria-hidden="true"><span style={{ width }} /></div>
            </div>
          )
        })}
      </div>
    )
  }

  const plotWidth = WIDTH - LEFT - RIGHT
  const plotHeight = HEIGHT - TOP - BOTTOM
  const slotWidth = data.length ? plotWidth / data.length : plotWidth
  const barWidth = Math.max(4, slotWidth * 0.58)
  const ticks = xTickIndexes(data.length)

  return (
    <div className="dashboard-chart dashboard-bar-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
        {[1, 0.5, 0].map((ratio) => {
          const tickY = TOP + plotHeight * (1 - ratio)
          return (
            <g key={ratio}>
              <line className="dashboard-chart-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={tickY} y2={tickY} />
              <text className="dashboard-chart-axis" x={LEFT - 8} y={tickY + 4} textAnchor="end">{Math.round(maxValue * ratio)}</text>
            </g>
          )
        })}
        {data.map((row, index) => {
          const value = safeNumber(row?.[valueKey])
          const height = value * plotHeight / scaleMax
          const barX = LEFT + index * slotWidth + (slotWidth - barWidth) / 2
          return <rect className="dashboard-bar-rect" x={barX} y={TOP + plotHeight - height} width={barWidth} height={height} rx="3" key={row.date ?? index} />
        })}
        {data.map((row, index) => ticks.has(index) ? (
          <text className="dashboard-chart-axis dashboard-chart-x-label" x={LEFT + index * slotWidth + slotWidth / 2} y={HEIGHT - 8} textAnchor="middle" key={`label-${row.date ?? index}`}>
            {row?.[labelKey]}
          </text>
        ) : null)}
      </svg>
    </div>
  )
}

export default DashboardBarChart
```

- [ ] **Step 5: Implement payment-method composition with privacy-aware legend**

Create `src/components/DashboardPaymentMix.jsx`:

```jsx
const MASK = '••••••'
const safeNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function DashboardPaymentMix({ data = [], formatValue = (value) => String(value), valuesVisible = true, ariaLabel = 'Formas de pagamento' }) {
  const total = data.reduce((sum, item) => sum + safeNumber(item.amount), 0)

  if (!data.length || total <= 0) {
    return <div className="dashboard-chart-empty">Nenhum pagamento recebido no período.</div>
  }

  const accessibleSummary = valuesVisible
    ? data.map((item) => `${item.method}: ${formatValue(item.amount)}`).join(', ')
    : 'Valores ocultos.'

  return (
    <div className="dashboard-payment-mix" role="img" aria-label={`${ariaLabel}. ${accessibleSummary}`}>
      <div className="dashboard-payment-track" aria-hidden="true">
        {data.map((item, index) => (
          <span
            className={`dashboard-payment-segment dashboard-series-${index % 6 + 1}`}
            style={{ width: `${safeNumber(item.amount) * 100 / total}%` }}
            key={item.method}
          />
        ))}
      </div>
      <div className="dashboard-payment-legend">
        {data.map((item, index) => (
          <div className="dashboard-payment-legend-row" key={item.method}>
            <span className={`dashboard-payment-dot dashboard-series-${index % 6 + 1}`} aria-hidden="true" />
            <span>{item.method}</span>
            <strong>{valuesVisible ? formatValue(item.amount) : MASK}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DashboardPaymentMix
```

- [ ] **Step 6: Re-run the chart tests to verify GREEN**

Run:

```bash
node --test src/dashboardCharts.test.js
```

Expected: PASS.

- [ ] **Step 7: Run lint and build before committing the chart primitives**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands succeed.

Commit:

```bash
git add src/components/DashboardLineChart.jsx src/components/DashboardBarChart.jsx src/components/DashboardPaymentMix.jsx src/dashboardCharts.test.js
git commit -m "feat: add lightweight dashboard charts"
```

---

### Task 4: Compose the new Dashboard and monetary privacy behavior

**Files:**
- Modify: `src/pages/Dashboard.jsx`
- Create: `src/pages/DashboardAnalytics.test.js`
- Create: `src/dashboard.css`
- Reuse without modification: `src/components/StatCard.jsx`, `src/components/PageHeader.jsx`, `src/components/PaymentBadge.jsx`, `src/components/StatusBadge.jsx`

**Interfaces:**
- Consumes all Task 1 analytics functions and Task 2/3 presentation components.
- Keeps the existing Dashboard prop contract unchanged: `Dashboard({ totals, orders, currency, onNewOrder })`.
- Produces local state:
  - `period`, initialized to `'30d'`.
  - `valuesVisible`, initialized to `true` and never persisted.
- Produces `displayMoney(value)` which returns `currency(value)` when visible and `••••••` when hidden.

- [ ] **Step 1: Write the failing Dashboard structure/privacy test**

Create `src/pages/DashboardAnalytics.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard defaults analytics to 30 days and keeps the existing operational summary', () => {
  const page = source('./Dashboard.jsx')

  assert.match(page, /useState\(['"]30d['"]\)/)
  assert.match(page, /Vendas hoje/)
  assert.match(page, /Recebido hoje/)
  assert.match(page, /A receber/)
  assert.match(page, /Pedidos ativos/)
  assert.match(page, /Vendas no período/)
  assert.match(page, /Pedidos no período/)
  assert.match(page, /Ticket médio/)
  assert.match(page, /DashboardPeriodSelector/)
})

test('dashboard renders all four approved analytics visualizations', () => {
  const page = source('./Dashboard.jsx')

  assert.match(page, /Vendas por dia/)
  assert.match(page, /Pedidos por dia/)
  assert.match(page, /Top 5 produtos/)
  assert.match(page, /Formas de pagamento/)
  assert.match(page, /DashboardLineChart/)
  assert.match(page, /DashboardBarChart/)
  assert.match(page, /DashboardPaymentMix/)
})

test('one global eye control starts visible and masks dashboard money without persistence', () => {
  const page = source('./Dashboard.jsx')

  assert.match(page, /useState\(true\)/)
  assert.match(page, /Ocultar valores/)
  assert.match(page, /Mostrar valores/)
  assert.match(page, /const MONEY_MASK = ['"]••••••['"]/)
  assert.match(page, /displayMoney\(totals\.salesToday\)/)
  assert.match(page, /displayMoney\(totals\.receivedToday\)/)
  assert.match(page, /displayMoney\(totals\.receivables\)/)
  assert.match(page, /displayMoney\(metrics\.sales\)/)
  assert.match(page, /displayMoney\(metrics\.averageTicket\)/)
  assert.match(page, /displayMoney\(order\.total\)/)
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/)
})
```

- [ ] **Step 2: Run the Dashboard test to verify RED**

Run:

```bash
node --test src/pages/DashboardAnalytics.test.js
```

Expected: FAIL because the current Dashboard does not have analytics state/components/privacy behavior.

- [ ] **Step 3: Replace `Dashboard.jsx` with the approved composition**

Use this implementation shape, preserving the existing prop API:

```jsx
import { useMemo, useState } from 'react'
import '../dashboard.css'
import Button from '../components/Button'
import DashboardBarChart from '../components/DashboardBarChart'
import DashboardLineChart from '../components/DashboardLineChart'
import DashboardPaymentMix from '../components/DashboardPaymentMix'
import DashboardPeriodSelector from '../components/DashboardPeriodSelector'
import PageHeader from '../components/PageHeader'
import PaymentBadge from '../components/PaymentBadge'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import Icon from '../components/Icon'
import {
  buildDailySeries,
  calculatePeriodMetrics,
  getPaymentMix,
  getTopProducts,
} from '../utils/dashboardAnalytics.js'
import { getOrderItemsSummary } from '../utils/orderCart.js'
import { formatOrderDate, toLocalDateValue } from '../utils/orderWorkflow'

const MONEY_MASK = '••••••'
const PERIOD_HELPERS = {
  today: 'Somente hoje',
  '7d': 'Hoje + 6 dias anteriores',
  '30d': 'Hoje + 29 dias anteriores',
}

function Dashboard({ totals, orders, currency, onNewOrder }) {
  const [period, setPeriod] = useState('30d')
  const [valuesVisible, setValuesVisible] = useState(true)
  const writeDisabled = typeof navigator !== 'undefined' && !navigator.onLine
  const todayValue = toLocalDateValue()

  const analytics = useMemo(() => {
    const now = new Date()
    return {
      metrics: calculatePeriodMetrics(orders, period, now),
      daily: buildDailySeries(orders, period, now),
      topProducts: getTopProducts(orders, period, now),
      paymentMix: getPaymentMix(orders, period, now),
    }
  }, [orders, period, todayValue])

  const displayMoney = (value) => valuesVisible ? currency(value) : MONEY_MASK
  const privacyLabel = valuesVisible ? 'Ocultar valores' : 'Mostrar valores'
  const { metrics, daily, topProducts, paymentMix } = analytics

  return (
    <>
      <PageHeader
        eyebrow="Resumo do dia"
        title="Visão geral da operação"
        description="Acompanhe a operação de hoje e a evolução recente do negócio."
        actions={(
          <>
            <button
              type="button"
              className="icon-button icon-button-neutral dashboard-privacy-toggle"
              aria-label={privacyLabel}
              title={privacyLabel}
              onClick={() => setValuesVisible((current) => !current)}
            >
              <Icon name={valuesVisible ? 'eye' : 'eye-off'} size={20} />
            </button>
            <Button icon="plus" onClick={onNewOrder} disabled={writeDisabled}>Novo pedido</Button>
          </>
        )}
      />

      <section className="stats-grid" aria-label="Indicadores principais">
        <StatCard label="Vendas hoje" value={displayMoney(totals.salesToday)} helper="Pedidos da data de hoje" icon="receipt" tone="success" />
        <StatCard label="Recebido hoje" value={displayMoney(totals.receivedToday)} helper="Pagamentos confirmados" icon="arrow-up" tone="success" />
        <StatCard label="A receber" value={displayMoney(totals.receivables)} helper="Pagamentos pendentes" icon="wallet" tone="warning" />
        <StatCard label="Pedidos ativos" value={totals.activeOrders} helper="Na fila de preparo" icon="orders" />
      </section>

      <section className="dashboard-performance-section" aria-labelledby="dashboard-performance-title">
        <div className="dashboard-performance-heading">
          <div>
            <span className="section-kicker">Desempenho</span>
            <h2 id="dashboard-performance-title">Visão do período</h2>
            <p>{PERIOD_HELPERS[period]}</p>
          </div>
          <DashboardPeriodSelector value={period} onChange={setPeriod} />
        </div>

        <div className="stats-grid stats-grid-three dashboard-period-stats">
          <StatCard label="Vendas no período" value={displayMoney(metrics.sales)} helper="Valor dos pedidos registrados" icon="receipt" tone="success" />
          <StatCard label="Pedidos no período" value={metrics.orderCount} helper="Quantidade de pedidos" icon="orders" />
          <StatCard label="Ticket médio" value={displayMoney(metrics.averageTicket)} helper="Venda média por pedido" icon="ticket" />
        </div>
      </section>

      <section className="dashboard-analytics-grid" aria-label="Gráficos de desempenho">
        <article className="surface-card dashboard-chart-card">
          <div className="section-heading">
            <div><span className="section-kicker">Tendência</span><h2>Vendas por dia</h2></div>
            <div className="section-meta">{PERIOD_HELPERS[period]}</div>
          </div>
          <DashboardLineChart data={daily} valueKey="sales" labelKey="label" formatValue={currency} valuesVisible={valuesVisible} ariaLabel="Vendas por dia no período selecionado" />
        </article>

        <article className="surface-card dashboard-chart-card">
          <div className="section-heading">
            <div><span className="section-kicker">Volume</span><h2>Pedidos por dia</h2></div>
            <div className="section-meta">{metrics.orderCount} pedidos</div>
          </div>
          <DashboardBarChart data={daily} valueKey="orders" labelKey="label" formatValue={(value) => String(value)} ariaLabel="Pedidos por dia no período selecionado" />
        </article>

        <article className="surface-card dashboard-chart-card">
          <div className="section-heading">
            <div><span className="section-kicker">Produtos</span><h2>Top 5 produtos</h2></div>
            <div className="section-meta">Por unidades vendidas</div>
          </div>
          <DashboardBarChart data={topProducts} valueKey="quantity" labelKey="label" formatValue={(value) => `${value} un.`} orientation="horizontal" ariaLabel="Top 5 produtos por quantidade vendida" />
        </article>

        <article className="surface-card dashboard-chart-card">
          <div className="section-heading">
            <div><span className="section-kicker">Recebimentos</span><h2>Formas de pagamento</h2></div>
            <div className="section-meta">Pedidos pagos</div>
          </div>
          <DashboardPaymentMix data={paymentMix} formatValue={currency} valuesVisible={valuesVisible} ariaLabel="Valores recebidos por forma de pagamento" />
        </article>
      </section>

      <section className="surface-card dashboard-section dashboard-recent-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Operação</span>
            <h2>Pedidos recentes</h2>
          </div>
          <div className="section-meta"><Icon name="orders" size={18} /> Últimos registros</div>
        </div>

        <div className="recent-orders">
          {orders.slice(0, 6).map((order) => (
            <article className="recent-order" key={order.id}>
              <div className="recent-order-avatar">{order.client.charAt(0).toUpperCase()}</div>
              <div className="recent-order-main">
                <strong>{order.client}</strong>
                <span>{getOrderItemsSummary(order)} · {order.type}</span>
              </div>
              <div className="recent-order-statuses">
                <StatusBadge status={order.status} />
                <PaymentBadge order={order} />
              </div>
              <div className="recent-order-value">
                <strong>{displayMoney(order.total)}</strong>
                <span>{formatOrderDate(order.orderDate)}</span>
              </div>
            </article>
          ))}

          {!orders.length && (
            <div className="empty-state">
              <Icon name="orders" size={28} />
              <strong>Nenhum pedido registrado</strong>
              <span>Crie o primeiro pedido para começar a acompanhar a operação.</span>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Dashboard
```

The `useState(true)` location is intentionally inside `Dashboard`; because the tab is conditionally rendered by `App.jsx`, leaving and reopening Dashboard remounts it and restores visible monetary values without persistence.

- [ ] **Step 4: Add the initial dashboard stylesheet so the new markup builds cleanly**

Create `src/dashboard.css` with the base component classes. Keep all colors on existing theme tokens:

```css
.dashboard-privacy-toggle {
  width: 44px;
  height: 44px;
}

.dashboard-performance-section {
  margin: 30px 0 22px;
}

.dashboard-performance-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
}

.dashboard-performance-heading h2 {
  margin: 0;
  color: var(--text);
  font-size: 1.25rem;
}

.dashboard-performance-heading p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.dashboard-period-selector {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.dashboard-period-option {
  min-height: 40px;
  padding: 0 14px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  font-weight: 750;
}

.dashboard-period-option.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.dashboard-period-stats {
  margin-bottom: 0;
}

.dashboard-analytics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 22px;
}

.dashboard-chart-card {
  min-width: 0;
  overflow: hidden;
}

.dashboard-chart {
  width: 100%;
  overflow: hidden;
}

.dashboard-chart svg {
  width: 100%;
  height: auto;
  display: block;
}

.dashboard-chart-grid {
  stroke: var(--border);
  stroke-width: 1;
}

.dashboard-chart-axis {
  fill: var(--muted);
  font-size: 11px;
}

.dashboard-line-chart {
  color: var(--primary);
}

.dashboard-line-path {
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dashboard-line-point,
.dashboard-bar-rect {
  fill: currentColor;
}

.dashboard-bar-chart {
  color: var(--info);
}

.dashboard-horizontal-bars,
.dashboard-payment-legend {
  display: grid;
  gap: 12px;
}

.dashboard-horizontal-bar-copy,
.dashboard-payment-legend-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.dashboard-horizontal-bar-copy span,
.dashboard-payment-legend-row > span:nth-child(2) {
  min-width: 0;
  flex: 1;
  color: var(--text-soft);
  overflow-wrap: anywhere;
}

.dashboard-horizontal-bar-copy strong,
.dashboard-payment-legend-row strong {
  color: var(--text);
  white-space: nowrap;
}

.dashboard-horizontal-bar-track,
.dashboard-payment-track {
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-strong);
}

.dashboard-horizontal-bar-track {
  height: 9px;
  margin-top: 6px;
}

.dashboard-horizontal-bar-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
}

.dashboard-payment-track {
  height: 16px;
  display: flex;
  margin-bottom: 18px;
}

.dashboard-payment-segment {
  min-width: 2px;
  height: 100%;
}

.dashboard-payment-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
  border-radius: 50%;
}

.dashboard-series-1 { background: var(--primary); }
.dashboard-series-2 { background: var(--success); }
.dashboard-series-3 { background: var(--warning); }
.dashboard-series-4 { background: var(--info); }
.dashboard-series-5 { background: var(--purple); }
.dashboard-series-6 { background: var(--text-soft); }

.dashboard-chart-empty {
  min-height: 160px;
  display: grid;
  place-items: center;
  padding: 24px;
  color: var(--muted);
  text-align: center;
  font-size: 0.82rem;
}

.dashboard-recent-section {
  margin-top: 0;
}
```

- [ ] **Step 5: Re-run Dashboard and chart/control tests to verify GREEN**

Run:

```bash
node --test src/pages/DashboardAnalytics.test.js src/dashboardControls.test.js src/dashboardCharts.test.js src/utils/dashboardAnalytics.test.js
```

Expected: PASS.

- [ ] **Step 6: Build once to catch JSX/CSS integration errors**

Run:

```bash
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 7: Review privacy behavior line-by-line and commit**

Confirm all explicit Dashboard monetary text passes through `displayMoney(...)` or a chart `valuesVisible` prop, and confirm there is no storage call.

Commit:

```bash
git add src/pages/Dashboard.jsx src/pages/DashboardAnalytics.test.js src/dashboard.css
git commit -m "feat: redesign dashboard analytics view"
```

---

### Task 5: Responsive/accessibility hardening and full validation

**Files:**
- Create: `src/dashboardResponsive.test.js`
- Modify: `src/dashboard.css`
- Verify only: `src/pages/Dashboard.jsx`, `src/components/DashboardLineChart.jsx`, `src/components/DashboardBarChart.jsx`, `src/components/DashboardPaymentMix.jsx`

**Interfaces:**
- No new public interfaces.
- This task guarantees the approved UI contracts at narrow widths, touch-target sizing, theme-token usage, and privacy-safe accessibility copy.

- [ ] **Step 1: Write the failing responsive/theme contract test**

Create `src/dashboardResponsive.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('dashboard analytics stacks on mobile and keeps tap targets usable', () => {
  const css = source('./dashboard.css')

  assert.match(css, /@media \(max-width: 820px\)/)
  assert.match(css, /@media \(max-width: 640px\)/)
  assert.match(css, /\.dashboard-analytics-grid[\s\S]*grid-template-columns:\s*1fr/)
  assert.match(css, /\.dashboard-period-option[\s\S]*min-height:\s*44px/)
  assert.match(css, /\.dashboard-privacy-toggle[\s\S]*44px/)
})

test('dashboard chart styling uses theme variables instead of hard-coded chart colors', () => {
  const css = source('./dashboard.css')

  assert.match(css, /var\(--primary\)/)
  assert.match(css, /var\(--success\)/)
  assert.match(css, /var\(--warning\)/)
  assert.match(css, /var\(--info\)/)
  assert.match(css, /var\(--purple\)/)
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}/)
})

test('hidden monetary chart copy never exposes exact values through aria labels', () => {
  const line = source('./components/DashboardLineChart.jsx')
  const payment = source('./components/DashboardPaymentMix.jsx')

  assert.match(line, /valuesVisible \? ariaLabel : `\$\{ariaLabel\}\. Valores ocultos\.`/)
  assert.match(payment, /valuesVisible[\s\S]*Valores ocultos\./)
})
```

- [ ] **Step 2: Run the responsive contract test to verify RED**

Run:

```bash
node --test src/dashboardResponsive.test.js
```

Expected: FAIL because the first `dashboard.css` version does not yet include the mobile hardening and its period buttons are only 40px tall.

- [ ] **Step 3: Add responsive and focus/touch rules to `dashboard.css`**

Append/update these rules:

```css
.dashboard-period-option {
  min-height: 44px;
}

.dashboard-period-option:focus-visible,
.dashboard-privacy-toggle:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary) 22%, transparent);
  outline-offset: 2px;
}

.dashboard-chart-x-label {
  pointer-events: none;
}

@media (max-width: 820px) {
  .dashboard-performance-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .dashboard-period-selector {
    width: 100%;
  }

  .dashboard-period-option {
    flex: 1;
  }

  .dashboard-analytics-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .dashboard-performance-section {
    margin-top: 24px;
  }

  .dashboard-period-selector {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .dashboard-period-option {
    min-width: 0;
    padding-inline: 8px;
    font-size: 0.78rem;
  }

  .dashboard-chart-card .section-heading {
    gap: 8px;
  }

  .dashboard-chart-axis {
    font-size: 10px;
  }

  .dashboard-horizontal-bar-copy,
  .dashboard-payment-legend-row {
    align-items: flex-start;
  }

  .dashboard-payment-legend-row {
    flex-wrap: wrap;
  }

  .dashboard-payment-legend-row strong {
    margin-left: 20px;
  }
}
```

If `color-mix()` is considered too risky for the project browser target during execution, replace only the focus outline with the existing global focus styling and remove this specific rule rather than introducing hard-coded chart colors. The chart/data colors themselves must remain theme-variable-only.

- [ ] **Step 4: Re-run the responsive contract test to verify GREEN**

Run:

```bash
node --test src/dashboardResponsive.test.js
```

Expected: PASS.

- [ ] **Step 5: Run the complete automated test suite**

Run:

```bash
npm test
```

Expected: all tests pass, including analytics, controls, charts, Dashboard composition, responsive/theme contract, and all pre-existing application tests.

- [ ] **Step 6: Run lint**

Run:

```bash
npm run lint
```

Expected: zero warnings and zero errors.

- [ ] **Step 7: Run production build**

Run:

```bash
npm run build
```

Expected: Vite production build succeeds.

- [ ] **Step 8: Validate the Cloudflare Worker bundle without deploying**

Run:

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
```

Expected: dry-run succeeds and still reports the existing `DB` binding to `amor-e-sabor-delivery`; no migration is involved.

- [ ] **Step 9: Perform the acceptance checklist against the approved spec**

Verify all eleven spec acceptance criteria explicitly:

1. Four operational cards + `Novo pedido` remain.
2. Analytics defaults to 30 days and selector offers Hoje / 7 dias / 30 dias.
3. One period controls all period KPIs and all four analytics visualizations.
4. Sales include paid and unpaid orders by `orderDate`.
5. Payment mix includes paid orders only and uses confirmed amount fallback rules.
6. Daily series contains zero-value dates.
7. One eye hides every explicit Dashboard monetary value while counts/geometry stay visible.
8. Eye state starts visible on Dashboard mount and is not persisted.
9. Layout is usable on mobile and both theme palettes rely on variables.
10. No backend/API/D1 changes were introduced.
11. Automated tests + lint + build + Wrangler dry-run are all green.

- [ ] **Step 10: Commit the hardening and final tests**

```bash
git add src/dashboard.css src/dashboardResponsive.test.js
git commit -m "test: harden dashboard responsive analytics"
```

- [ ] **Step 11: Final branch review before integration**

Compare the implementation branch to its base and confirm the net feature diff is limited to:

```text
src/components/DashboardBarChart.jsx
src/components/DashboardLineChart.jsx
src/components/DashboardPaymentMix.jsx
src/components/DashboardPeriodSelector.jsx
src/components/Icon.jsx
src/dashboard.css
src/dashboardCharts.test.js
src/dashboardControls.test.js
src/dashboardResponsive.test.js
src/pages/Dashboard.jsx
src/pages/DashboardAnalytics.test.js
src/utils/dashboardAnalytics.js
src/utils/dashboardAnalytics.test.js
```

Plus the already-approved spec/plan documents. There should be no Worker, migration, API, repository, or dependency-file changes.
