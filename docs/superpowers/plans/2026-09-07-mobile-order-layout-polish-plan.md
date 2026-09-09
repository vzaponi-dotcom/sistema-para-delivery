# Mobile Order Layout Polish Implementation Plan

**Goal:** Finish the approved PR #12 mobile UX round by preserving the already-implemented compact segmented controls and redesigning cart items to match approved mockup A without changing order behavior.

**Architecture:** Keep this a presentation-only change. Reuse the existing `Icon` component and shared `CATEGORY_ICON_NAMES` / `categoryForUi` catalog metadata instead of introducing new category rules. Add cart-specific responsive overrides to the existing PR #12 stylesheet so desktop behavior and unrelated order controls remain isolated.

**Tech stack:** React, CSS, Node test runner, Vite, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-07-mobile-order-layout-polish-design.md`

## Global constraints

- Work only on `feature/mobile-compact-order-kitchen-controls` / PR #12.
- Never commit directly to `master` and never deploy production in this plan.
- No changes to APIs, Workers behavior, D1 schema/data, printing, RawBT, scheduled-order logic, cancellation logic, or Windows/QZ.
- Strict TDD for the remaining cart redesign: commit/observe RED before production-code changes, then implement minimal GREEN.
- Keep current quantity callbacks, observation callbacks, remove callback, calculations, and disabled semantics intact.
- Reuse the shared category icon mapping rather than duplicating category knowledge.

## Task 1: Lock the remaining cart design in a RED regression test

**Files:**
- Modify: `src/mobileCompactControls.test.js`
- Read only: `src/components/OrderCart.jsx`
- Read only: `src/mobile-compact-controls.css`
- Read only: `shared/productCatalog.js`

**Step 1: Add failing structural assertions**

Extend the dedicated mobile compact-controls regression suite to require:
- `OrderCart.jsx` imports `Icon`.
- `OrderCart.jsx` imports and uses `CATEGORY_ICON_NAMES` and `categoryForUi` from the shared catalog.
- each cart line renders a `.new-order-cart-category-icon` with the mapped semantic icon;
- existing quantity update, note, and remove handlers remain present;
- the mobile stylesheet defines the approved compact cart grid/areas and a substantially smaller quantity pill/buttons than the previous forced 44 px circles.

**Step 2: Commit test only**

Commit message: `test: define compact mobile cart contract`

**Step 3: Verify RED**

Wait for the PR validation workflow. Confirm the new cart-contract test fails for the expected missing icon/layout assertions, not because of syntax, setup, or unrelated failures.

## Task 2: Implement the compact cart item presentation

**Files:**
- Modify: `src/components/OrderCart.jsx`
- Modify: `src/mobile-compact-controls.css`

**Step 1: Wire semantic category icons**

In `OrderCart.jsx`:
- import `Icon`;
- import `CATEGORY_ICON_NAMES` and `categoryForUi` from `shared/productCatalog.js`;
- derive the canonical UI category for each item;
- render a dedicated category-icon element using the shared mapping;
- keep the existing name/category/size text, observation states, quantity callbacks, line-total calculation, and remove action unchanged.

No new category mapping should be created locally.

**Step 2: Implement mockup-A mobile layout**

In `src/mobile-compact-controls.css`:
- keep the category icon hidden/non-disruptive outside mobile if necessary;
- on mobile, make each cart line a compact grid with semantic icon on the left, product/observation content at the top, compact quantity pill below, and total/remove at the right;
- reduce padding and gaps compared with the current mobile cart;
- override the current 44 px quantity circles with compact dimensions while keeping the controls visibly/tactually usable;
- keep unit price under the quantity pill;
- prevent long names/metadata from producing horizontal overflow;
- preserve theme-token colors and existing button variants.

**Step 3: Commit implementation**

Prefer small commits if JSX wiring and CSS treatment are independently reviewable; otherwise one cohesive commit is acceptable.

Suggested messages:
- `feat: add category icons to cart items`
- `fix: compact mobile cart item layout`

**Step 4: Verify GREEN**

Confirm the dedicated regression suite passes and the full validation workflow proceeds through tests, lint, build, production Worker dry-run, staging Worker dry-run, and local D1 migration.

## Task 3: Regression review and full gate

**Files:**
- Review the entire PR #12 diff.
- Update PR description if necessary.

**Step 1: Inspect full diff**

Confirm there are no edits outside the approved mobile/layout/spec/test scope and no business-rule changes.

**Step 2: Confirm complete CI**

Require the latest `Validate application` workflow on the final head SHA to complete successfully. Do not rely on an earlier green run.

**Step 3: Update PR #12 summary**

Document the cart compact layout, category icon reuse, TDD RED/GREEN evidence, and final CI result while keeping the PR draft until physical staging homologation.

## Task 4: Staging and physical homologation

- Deploy only the PR #12 feature branch to staging after CI is fully green.
- On a real mobile device, validate:
  1. three order-type buttons remain horizontal;
  2. three local-identity buttons remain horizontal with icons;
  3. kitchen header uses four actions in one row at normal phone width and fallback 2×2 on very narrow width;
  4. cart item card visually matches approved mockup A: category icon, readable name/category, observation action, compact `− 1 +` pill, unit price, line total, and remove action;
  5. increasing/decreasing quantity, adding/editing observation, and removing an item still work;
  6. light and dark themes remain readable;
  7. there is no horizontal overflow.
- Do not merge or deploy production until the user explicitly approves the staging result.
# **SUPERSEDED (2026-09-08):** Documento histórico substituído pela arquitetura QZ centralizada. Consulte a spec/plano centralizados de 2026-09-08.
