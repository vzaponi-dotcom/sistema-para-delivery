# Mesiva Nova venda Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** Apply the approved Nova venda proposal to the existing three-step order flow and staging.
**Architecture:** Keep NewOrder as sole draft owner. Reuse OrderCart for editable summaries, SystemSelect for checkout adjustments, and BottomSheet for mobile cart. Scope visual changes to a new-order-refined wrapper and stylesheet.
**Tech Stack:** React 19, Vite, existing Node test/render harness, CSS.
**Spec:** User-approved outputs/mesiva-nova-venda-proposta-v1.html in the parent workspace, including corrected adjustment selectors.

## Global constraints

- Preserve existing scheduling, local reservations, modalities, permissions, dirty guards and payment/printing workflows.
- No fictitious data, simulated actions or prototype notices in the application.
- Desktop summary on right; mobile fixed footer; light/dark using shared theme tokens.
- Continue the clean isolated task checkout on feature/mesiva-kitchen-visual, PR #84. Staging only; no production or merge.

## Review focus

- Cart rows with different notes must retain their line IDs when edited from summary or mobile cart.
- Restricted users cannot adjust values or create clients through new UI.
- Reservations preserve local-only saving; payment UI must suppress sticky save while receiving payment.
- Long names and 320/390/834px layouts must not overflow or hide selectable controls.
- Schedule context uses business timezone; switching steps must retain draft and edits.

## Tasks

- [x] 1. Add behavioral render tests for editable summary, mobile cart and separated checkout fields; watch new assertions fail.
- [x] 2. Integrate context strip, attendance summary, compact steps/catalog and editable cart, preserving the single draft callbacks.
- [x] 3. Move checkout fields under review cart; retain SystemSelect/BRL masks; add sticky mobile actions and scoped approved CSS.
- [x] 4. Run targeted/full tests, lint, architecture and build; inspect actual React UI on desktop/mobile in both themes.
- [ ] 5. Review diff with a fresh reviewer, fix concrete findings, update PR #84 and deploy staging; smoke-test without creating real orders.

## Execution ledger

- Base 1931ff7, clean dedicated checkout. Ruling: reuse existing task checkout rather than create a new worktree; continuation of the already authorized branch/staging workflow.
- Tests will target new interactions; visual styling checked in browser rather than implementation-mirroring assertions.

- Implemented approved layout and native selectors; visual checks passed in light/dark and 320/390/834px. Reviewer findings (sheet focus during notes and exact-line compact removal) corrected with RED/GREEN regressions. Final full suite and staging publication pending.

- Final suite: 2,785 passing, zero failures. Build, lint (pre-existing warnings), architecture and diff whitespace checks passed. Fresh review found no remaining P1/P2; publication and staging smoke pending.
