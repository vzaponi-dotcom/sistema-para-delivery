# Order Operations Workflow

Date: 2026-09-01
Branch: `master`

## Goal

Reduce manual status handling so the order screen works like an operational kitchen queue instead of a CRUD status tracker.

## Approved Workflow

- Every newly created order enters the active queue immediately as `Em preparo`.
- There is no `Novo`, `Pendente`, or `Pronto` step in the active workflow.
- A human performs only one final action per order.
- For `Entrega`, the final action label is `Saiu para entrega` and the order is considered finished for the restaurant operation.
- For `Retirada` and `Local`, the final action label is `Finalizar`.
- Finished orders leave the active queue and remain available in a compact history section.

## Operational Signals

The system derives urgency from elapsed time; the user does not change it manually.

- Under 15 minutes: normal.
- 15 to 24 minutes: attention.
- 25 minutes or more: delayed.

The active queue is ordered oldest first.

## Data Model

New orders store:

- `createdAt`: ISO timestamp when the order is created.
- `finishedAt`: `null` while active; ISO timestamp when finalized.
- `status`: `Em preparo` while active and `Finalizado` after the final action, retained mainly for compatibility/display.

Existing localStorage data must continue to load. Old orders without timestamps are normalized at read time without deleting user data.

## Orders Screen

The page shows:

- count of active orders in preparation;
- count of delayed active orders;
- count of orders finalized today;
- active operational queue with elapsed time, product, quantity, type, total, and one final action button;
- compact finalized history below the queue;
- search continues to work across active and finalized orders.

The status dropdown is removed from the new-order modal.

## Dashboard

Dashboard recent-order display remains compatible with both active and finalized orders. Active orders display `Em preparo`; finalized orders display `Finalizado`.

## Constraints

- Preserve current React 19 + Vite stack.
- Preserve existing localStorage keys.
- No global state library.
- No backend changes.
- No order scheduling in this iteration.
- Keep delete available as a secondary corrective action, not the primary workflow.
- Responsive behavior must work on desktop and mobile.
