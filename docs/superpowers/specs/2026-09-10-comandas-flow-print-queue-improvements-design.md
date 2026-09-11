# Comandas Flow and Print Queue Improvements Design

## Goal

Remove three operational frictions from Comandas: skip the already-satisfied table-selection step, keep background refresh visually stable, and send consolidated comandas through the central print queue.

## Approved behavior

- Opening a new order from Comandas with `initialTableId` starts on `NEW_ORDER_STEPS.PRODUCTS`. Other entry points still start on `NEW_ORDER_STEPS.CUSTOMER`.
- A selected comanda shows `Carregando comanda…` only before its first successful detail load. Later refreshes preserve the current detail, do not render an updating message, and do not disable actions merely because a refresh is in flight.
- `Imprimir comanda` creates one manual central queue job from a canonical immutable `table-tab` print document. It never requires QZ on the requesting device.
- The queue identifies the job as `Comanda #<number>` and the associated table, and the primary Windows QZ station can claim and print it.
- Submission remains duplicate-safe in the UI while the request is pending and reports a visible success or error.

## Data and API design

Migration `0022_table_tab_print_jobs.sql` extends `print_jobs` with nullable `table_tab_id`, permits type `table-tab`, and enforces exactly one identity shape: order jobs have only `order_id`, table-tab jobs have only `table_tab_id`, and test jobs have neither. Existing rows and indexes are preserved; a table-tab history index is added.

`POST /api/table-tabs/:id/print-jobs` loads the currently open tab, builds the canonical consolidated document, and inserts a pending manual job with exactly one requested copy. A closed, transferred, foreign, or missing tab returns the existing not-found contract.

The central claim path accepts manual `table-tab` jobs as well as order jobs. Automatic eligibility and second-copy behavior remain order-only. Initial/recovery claiming supports safe, unsubmitted table-tab jobs.

## Interface design

The printing manager changes `printTableTab(id)` from local raw QZ output to the new API call. Print Queue derives table-tab identity from the immutable document, including sorting/search presentation where applicable, while retaining current order behavior.

## Verification

Focused tests cover the initial wizard step, silent refresh, client request, migration constraints, HTTP creation, queue claiming/rendering, duplicate suppression, and error feedback. The full test, lint, and build commands must pass before staging deployment. Production is out of scope.
