# Mobile order layout polish design

**Status:** Approved in product review on 2026-09-07

## Context

This round is limited to responsive/mobile presentation polish in the existing order flow and kitchen header. It must not change order rules, persistence, printing, APIs, D1 schema, scheduled-order behavior, or Windows/QZ work.

The implementation stays in `feature/mobile-compact-order-kitchen-controls` / PR #12, whose base is the current `master` containing PR #11.

## Approved behavior

### 1. Order type controls

On mobile, `Entrega`, `Retirada`, and `Consumo no local` remain in one horizontal row of three equal-width compact controls. The compact treatment applies only to this choice group and must not accidentally shrink unrelated controls such as `Agora` / `Agendado`.

### 2. Local identity controls

For local-consumption orders, `Nome`, `Mesa`, and `Cliente cadastrado` remain in one horizontal row of three equal-width compact controls on mobile.

Each option includes a small semantic icon:
- Nome: person/client icon.
- Mesa: table icon.
- Cliente cadastrado: clients icon.

Selected, disabled, light-theme, and dark-theme states continue to use the existing design tokens.

### 3. Kitchen header actions

On normal mobile widths, `Som`, `Impressão`, `Histórico`, and `Novo pedido` use the full available width in one row with four equal columns.

On very narrow screens (up to 340 px), they fall back to a 2 × 2 layout instead of squeezing text beyond usability.

### 4. Cart item card — approved mockup A

The mobile cart item card becomes materially denser while preserving all current content and actions.

Visual hierarchy:
- a semantic category icon appears at the left of each item; there is no dependency on product photos;
- the cart reuses the catalog's existing `CATEGORY_ICON_NAMES` mapping so `Refeições` uses the existing fork-and-knife `meal` icon and other categories stay consistent with product registration;
- product name and existing `categoria · apresentação/tamanho` metadata remain readable beside the icon;
- `+ Adicionar observação` (or the existing observation editor/summary state) remains directly associated with the product content;
- quantity uses the approved compact pill `− 1 +`, substantially smaller than the current oversized mobile control;
- unit price (`R$ X cada`) remains under the quantity control;
- line total and `Remover` remain grouped at the right/bottom-right of the card;
- the card should resemble mockup A in density, spacing, border radius, and information hierarchy, using the application's existing colors/tokens rather than introducing a new visual theme.

The category icon is the permanent no-photo treatment for this round. Future support for product photos is explicitly out of scope.

## Responsive and accessibility constraints

- No horizontal overflow on supported mobile widths.
- Labels may wrap where needed rather than overflow or clip.
- Controls must remain clearly tappable even after visual compaction.
- Existing focus, disabled, selected, observation-editing, quantity-update, and remove behavior must remain unchanged.
- Desktop behavior should remain stable unless a structural change is required to support the mobile layout; any new cart icon must not disrupt desktop layout.

## Non-goals

- Product photo upload/display.
- New product categories or category business rules.
- Changes to cart calculations or quantity semantics.
- Changes to order creation payloads.
- Changes to printing, RawBT, scheduled orders, cancellation, backend queueing, database, or Workers.
- Windows/QZ work.

## Validation

Implementation must follow TDD. Regression coverage should protect the responsive layout contracts, semantic category-icon wiring, and preservation of existing cart actions. Before staging, run the complete repository CI gate and review the full PR diff. Physical approval is required on staging before merge to `master`.