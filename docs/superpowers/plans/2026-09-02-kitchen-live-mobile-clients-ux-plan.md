# Kitchen Live, Mobile Motion, FAB and Clients UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add near-real-time kitchen updates with one-time sound alerts, smooth mobile transitions, fix the dashboard FAB, and compact the clients list.

**Architecture:** Add a lightweight orders-only read endpoint and keep polling orchestration in `App`, where order state already lives. Keep new-order detection in a small pure utility so one-time alert behavior is testable. Reuse existing `AppShell`, mobile navigation utilities and `BottomSheet` rather than adding dependencies.

**Tech Stack:** React 19, CSS, Node test runner, Cloudflare Worker/D1.

**Spec:** `docs/superpowers/specs/2026-09-02-kitchen-live-mobile-clients-ux-design.md`

## Global Constraints

- Poll orders every 2 seconds only while the Orders tab is active and the app is online.
- Initial synchronization never alerts; only subsequently discovered active orders alert once.
- No animation library or realtime infrastructure dependency.
- Respect `prefers-reduced-motion`.
- Reuse the existing BottomSheet and client edit/delete handlers.
- Preserve existing authentication/session-expiration behavior.

---

### Task 1: Orders-only refresh API and one-time new-order detection

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/index.js`
- Modify: `src/api/client.js`
- Create: `src/utils/orderRealtime.js`
- Create: `src/kitchenLiveRefresh.test.js`

**Interfaces:**
- Produces: `listOrders(db, businessId): Promise<Order[]>`
- Produces: `getOrders(): Promise<{orders: Order[]}>`
- Produces: `getNewActiveOrderIds(previousIds, orders): string[]`
- Produces: `activeOrderIdSet(orders): Set<string>`

- [ ] **Step 1: Write failing tests** asserting the Worker exposes authenticated `GET /api/orders`, the client exports `getOrders`, and the pure realtime helper identifies only active IDs that were not previously known.
- [ ] **Step 2: Run `npm test` and verify the new tests fail for the missing endpoint/helper.**
- [ ] **Step 3: Implement `listOrders` by reusing the existing order/item row mapping, add the GET route, add the client method, and implement the pure helper.**
- [ ] **Step 4: Run `npm test`, `npm run lint`, and `npm run build`; verify green.**
- [ ] **Step 5: Commit with `feat: add live order refresh endpoint`.**

### Task 2: Kitchen polling, visual alert and sound preference

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/Orders.jsx`
- Modify: `src/order-operations.css`
- Modify: `src/kitchenLiveRefresh.test.js`

**Interfaces:**
- Consumes: `getOrders()` and realtime helper from Task 1.
- Produces: `Orders` props `newOrderIds`, `soundEnabled`, `onSoundEnabledChange`.

- [ ] **Step 1: Extend the failing tests** to require a 2,000 ms active-orders polling interval, focus/visibility immediate refresh, initial-sync suppression, persisted sound preference, and a visual class for newly discovered cards.
- [ ] **Step 2: Run `npm test` and verify failure is caused by missing polling/sound behavior.**
- [ ] **Step 3: Add an Orders-tab-only effect in `App` that silently refreshes orders, maintains known IDs, marks newly discovered active IDs, plays a short Web Audio notification once per newly discovered order when enabled, and expires the visual highlight after a short timeout.**
- [ ] **Step 4: Add the sound toggle to the Orders header and CSS keyframes for a subtle new-order entrance/highlight. Ignore rejected playback promises.**
- [ ] **Step 5: Run tests/lint/build and commit with `feat: alert kitchen on new orders`.**

### Task 3: Mobile page transition and FAB stacking

**Files:**
- Modify: `src/components/AppShell.jsx`
- Modify: `src/mobile-navigation.css`
- Modify: `src/dashboard.css`
- Create: `src/mobilePageMotion.test.js`

**Interfaces:**
- Consumes: current `activeTab`, `onNavigate`, and mobile navigation ordering utility.
- Produces: directional content transition class/data attribute.

- [ ] **Step 1: Write failing tests** requiring directional transition markup/classes, a ~200 ms CSS animation, a reduced-motion override, FAB bottom offset above navigation, and FAB z-index above nav but below overlays.
- [ ] **Step 2: Run `npm test` and verify RED.**
- [ ] **Step 3: Track previous active mobile section in `AppShell`, apply direction metadata to the content wrapper, and add CSS animations plus the reduced-motion media query.**
- [ ] **Step 4: Correct mobile FAB offset and stacking without changing desktop placement.**
- [ ] **Step 5: Run tests/lint/build and commit with `fix: polish mobile navigation and order fab`.**

### Task 4: Compact phonebook clients with action sheet

**Files:**
- Modify: `src/pages/Clients.jsx`
- Modify: `src/App.css`
- Create: `src/clientsPhonebook.test.js`

**Interfaces:**
- Consumes: existing `BottomSheet`, `onEdit(client)`, `onDelete(clientId)`.
- Produces: full-row client interaction and selected-client action sheet.

- [ ] **Step 1: Write failing tests** requiring compact client rows with no avatar/action icons, row click opening BottomSheet, Edit and Delete sheet actions, and an explicit delete confirmation step.
- [ ] **Step 2: Run `npm test` and verify RED.**
- [ ] **Step 3: Replace the list markup with compact button-like rows, store the selected client, and render a BottomSheet with edit/delete actions.**
- [ ] **Step 4: Implement confirmation state inside the sheet before invoking the existing delete handler; close/reset the sheet after edit or successful delete.**
- [ ] **Step 5: Add responsive compact row styles, run tests/lint/build and commit with `feat: compact client phonebook`.**

### Task 5: Full regression validation

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run `npm test`.**
- [ ] **Step 2: Run `npm run lint`.**
- [ ] **Step 3: Run `npm run build`.**
- [ ] **Step 4: Run Worker dry-run validation.**
- [ ] **Step 5: Review CI on master and fix any regression before completion.**
