# Issue #30 — Split payments QA

## Candidate

- Date: 2026-09-21
- Base: `56c693ee505631191d4b09926fb6237d865910f5`
- Branch: `feature/split-payments`
- PR: #56 (draft/open)
- Executable candidate: `ece842a1818791be629529372e02440ce3116186`
- Final documentation SHA: the commit containing this report; recorded in the PR handoff after creation
- Production: **NO DEPLOY**

Remote Validate and staging fields are intentionally completed in the PR handoff after the single final branch push. This preserves the requested one-push workflow without inventing evidence that does not yet exist.

## Automated evidence

| Gate | Result |
| --- | --- |
| Full test suite | PASS — 2,020/2,020; 0 fail; 0 skipped |
| Architecture | PASS — `Frontend architecture boundaries: OK` |
| Lint | PASS — exit 0; warnings only |
| Build | PASS — 505 modules transformed |
| Worker production dry-run | PASS — no deploy |
| Worker staging dry-run | PASS — isolated staging D1 and rate limiter |
| Local D1 migrations | PASS — migration 0027 applied |
| Spec B D1 gate | PASS — 27 migrations and all transaction checks |
| Validate exact final SHA | PENDING — requires final push |
| Staging deploy | PENDING — blocked until exact-SHA Validate succeeds |

The first complete-suite run found two legacy finance fixtures that inserted `order-payment` movements without receipt/allocation identities. They were normalized in `ece842a`; focused tests passed 12/12 and the repeated complete suite passed 2,020/2,020.

## Source audit

- Payment command owners: `worker/paymentRepository.js`; HTTP and application adapters only delegate to it.
- Scalar `order.paymentMethod` reads remain only as explicit legacy presentation compatibility; writes use allocations.
- Checkout no longer submits the legacy scalar payment payload.
- No synthetic `Dinheiro + Pix` or `Múltiplas formas` storage label exists in production source.
- `qz-tray` remains restricted to `src/infrastructure/qz/qzTransport.js`.
- Feature migrations are exactly 0026 and 0027.
- No printing/QZ implementation, production secret, or deployment configuration changed.

## Manual staging matrix

Statuses are PENDING until the exact candidate is validated and deployed to staging. A capability case without a suitable restricted identity must be recorded as BLOCKED, never inferred as PASS.

| # | Case | Status |
| ---: | --- | --- |
| 1 | Order — 100% Pix | PENDING |
| 2 | Order — 100% Dinheiro | PENDING |
| 3 | Order — Dinheiro + Pix | PENDING |
| 4 | Order — three forms | PENDING |
| 5 | Order — remove second form | PENDING |
| 6 | Order — below total blocks | PENDING |
| 7 | Order — above total blocks | PENDING |
| 8 | Order — zero blocks | PENDING |
| 9 | Order — duplicate method blocks | PENDING |
| 10 | Order — method deactivated while modal is open requires review | PENDING |
| 11 | Order — double click does not duplicate | PENDING |
| 12 | Order — offline disables | PENDING |
| 13 | Entry point — Cozinha | PENDING |
| 14 | Entry point — Histórico | PENDING |
| 15 | Entry point — A Receber | PENDING |
| 16 | Checkout — save pending order | PENDING |
| 17 | Checkout — save and receive simple | PENDING |
| 18 | Checkout — save and receive mixed | PENDING |
| 19 | Checkout — paid automatic print job still follows existing rules | PENDING |
| 20 | Comanda — one order | PENDING |
| 21 | Comanda — multiple orders | PENDING |
| 22 | Comanda — one already-paid order | PENDING |
| 23 | Comanda — mixed payment creates correct Finance values | PENDING |
| 24 | Comanda — tab closes | PENDING |
| 25 | Comanda — table becomes free | PENDING |
| 26 | Comanda — reoccupied table survives old reconciliation | PENDING |
| 27 | Comanda — sync retry does not POST again | PENDING |
| 28 | Read — PaymentBadge simple | PENDING |
| 29 | Read — PaymentBadge mixed | PENDING |
| 30 | Read — order detail allocation breakdown | PENDING |
| 31 | Read — A Receber paid summary | PENDING |
| 32 | Search — Dinheiro finds mixed | PENDING |
| 33 | Search — Pix finds mixed | PENDING |
| 34 | Finance — each allocation is separate | PENDING |
| 35 | Finance — received total equals receipt total once | PENDING |
| 36 | Dashboard payment mix matches Finance movements | PENDING |
| 37 | Refund — simple original method suggestion | PENDING |
| 38 | Refund — inactive simple method requires review | PENDING |
| 39 | Refund — mixed receipt displays composition | PENDING |
| 40 | Refund — mixed receipt starts without invented method | PENDING |
| 41 | Refund — full refund confirms with active selected method | PENDING |
| 42 | Responsive — mobile light | PENDING |
| 43 | Responsive — mobile dark | PENDING |
| 44 | Responsive — desktop light | PENDING |
| 45 | Responsive — desktop dark | PENDING |
| 46 | Responsive — no horizontal overflow in composition editor | PENDING |
| 47 | Accessibility — keyboard/focus/add/remove usable | PENDING |
| 48 | Safety — console has no new errors | PENDING |
| 49 | Safety — print queue/settings behavior unaffected | PENDING |

## Staging migration verification

Pending exact-SHA staging deployment:

- no pending migrations;
- receipts exist for new staged payments;
- allocation sums equal receipt totals;
- split-payment `payments.method` is null;
- movement sums equal receipt totals;
- table-tab split movements are allocation-scoped and not duplicated per order.

No business-sensitive raw rows will be copied into this report or the PR handoff.

## Manual polish homologation — round 1

Date: 2026-09-21
Environment: staging
Result: **8 PASS / 0 FAIL / 0 BLOCKED**

| # | Case | Result |
| ---: | --- | --- |
| P1 | Single payment opens with default method and full amount prefilled | PASS |
| P2 | Approved card-based layout, spacing, summary hierarchy and “Adicionar outra forma” | PASS |
| P3 | Adding another method prefills the exact remaining amount | PASS |
| P4 | Auto remainder follows edits to another row while still automatic | PASS |
| P5 | Manual override of the remainder row stops automatic overwrite | PASS |
| P6 | Payment methods and icons render correctly, including multi-method combinations | PASS |
| P7 | Removing an allocation card recalculates the composition correctly | PASS |
| P8 | Under/over/exact totals correctly disable/enable confirmation | PASS |


## Manual homologation — round 2

Date: 2026-09-21
Environment: staging

Initial result: **9 PASS / 0 FAIL / 1 UX adjustment identified**

| # | Case | Result |
| ---: | --- | --- |
| B2-1 | Save and receive — simple payment | PASS |
| B2-2 | Save and receive — mixed payment | PASS |
| B2-3 | Mixed order detail shows allocation breakdown | PASS |
| B2-4 | Finance presentation for a mixed receipt | UX ADJUSTMENT — underlying allocation movements were correct, but two visible rows looked like two sales |
| B2-5 | Pending order payment from Kitchen | PASS |
| B2-6 | Pending order payment from History | PASS |
| B2-7 | Pending order payment from Receivables | PASS |
| B2-8 | Paid order leaves pending Receivables state | PASS |
| B2-9 | Search by each payment method finds the same mixed order | PASS |
| B2-10 | Double submit does not duplicate receipt/movements | PASS |

### B2-4 follow-up

Presentation-only correction implemented after manual feedback:
- allocation-backed movements remain separate in the financial model for exact per-method reporting;
- Finance now groups `source='order-payment'` movements by the same `receiptId` into one visible receipt row;
- the visible row shows the receipt total once plus the payment-method breakdown;
- totals/entries/exits continue to use raw movements and are unchanged;
- manual movements and legacy/simple order-payment movements remain unchanged.

Remote focused evidence:
- Split payment finance presentation run `35659953221` — SUCCESS
- 24 tests / 24 pass / 0 fail / 0 skipped
- architecture PASS
- lint PASS (109 warnings / 0 errors)
- build PASS
- staging Worker dry-run PASS
- staging deploy PASS
- Worker version `5737cb5e-7261-4419-a2ac-70f1420136fd`
- readiness PASS on attempt 1/4
- login smoke PASS HTTP 200

B2-4 status: **RETEST REQUIRED**.
