# Payments, Receivables and Order Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate order operation from payment control, add an A Receber workspace, automatically post paid orders into finance, and support editable backdated order dates.

**Architecture:** Orders remain the source of truth for sale/payment state. `orderWorkflow` owns operational/date normalization, while a new `paymentWorkflow` owns payment normalization and financial-entry creation. `App.jsx` coordinates persistence and modals; `Receivables.jsx` focuses on collection work and existing pages display payment information without adding operational clicks.

**Tech Stack:** React 19, Vite 8, browser localStorage, Node built-in test runner, CSS.

**Spec:** Conversation-approved flow: operation and payment are independent; payment starts pending and can become paid with method; A Receber lists pending orders; paying creates one financial movement; order date defaults to today and can be changed only to today/past.

## Global Constraints

- Keep the current `master` prototype workflow and localStorage keys compatible.
- No payment-partial support in this iteration.
- Supported payment methods: Pix, Dinheiro, Cartão de débito, Cartão de crédito, Transferência, Outro.
- Payment status is independent from `Em preparo` / `Finalizado`.
- Order date is `YYYY-MM-DD`, defaults to the local current date, and cannot be future-dated.
- A paid order must not generate duplicate automatic financial entries.

---

### Task 1: Payment and date domain rules

**Files:**
- Create: `src/utils/paymentWorkflow.js`
- Create: `src/utils/paymentWorkflow.test.js`
- Modify: `src/utils/orderWorkflow.js`
- Modify: `src/utils/orderWorkflow.test.js`

**Interfaces:**
- Produces: `normalizePayment`, `isOrderPaid`, `getPendingAmount`, `createOrderPaymentMovement`, `toLocalDateValue`, `formatOrderDate`.

- [ ] Write tests for pending defaults, paid normalization, pending amount, payment movement metadata, local order date, legacy date migration, and future-date rejection/fallback.
- [ ] Run `npm test` and confirm the new tests fail before implementation.
- [ ] Implement the minimal helpers and normalization.
- [ ] Run `npm test` and confirm all tests pass.

### Task 2: Order creation and payment mutation

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: payment/date helpers from Task 1.
- Produces: payment modal state, `handleRegisterPayment`, order-date form value, receivables data.

- [ ] Add `orderDate` to the order form with today's local date as default and `max=today`.
- [ ] Normalize stored orders with operational, date, and payment fields.
- [ ] Create orders with `paymentStatus: Pendente` while preserving operation status independently.
- [ ] Add payment registration that sets method/paid timestamp/value and creates one movement with `source: order-payment` and `orderId`.
- [ ] Keep manual financial movements available.

### Task 3: A Receber workspace

**Files:**
- Create: `src/pages/Receivables.jsx`
- Create: `src/receivables.css`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: normalized orders and `handleRegisterPayment`.

- [ ] Add `A Receber` to navigation.
- [ ] Show outstanding total, pending-order count, debtor count, and received-today total.
- [ ] Group pending orders by client and expose `Registrar pagamento` per order.
- [ ] Add a compact payment modal with payment method selection and full-order amount.

### Task 4: Operational/history and dashboard visibility

**Files:**
- Modify: `src/pages/Orders.jsx`
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/Finance.jsx`
- Modify: `src/order-operations.css`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: order date and payment fields.

- [ ] Show payment status/method and formatted order date in order cards/history without adding kitchen workflow steps.
- [ ] Change dashboard KPIs to sales today, received today, A Receber, and active orders.
- [ ] Show payment method/source metadata for automatic finance entries.
- [ ] Ensure responsive styling for receivables/payment badges/date input.

### Task 5: Verification

**Files:**
- Verify all changed files.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Confirm GitHub Actions completes successfully on the final `master` commit.
