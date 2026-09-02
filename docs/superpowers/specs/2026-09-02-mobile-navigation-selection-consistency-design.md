# Mobile navigation and selection consistency design

Date: 2026-09-02
Status: approved in chat, awaiting written-spec review
Branch: `feature/mobile-ux-selection-round`

## Goal

Improve the mobile experience without changing the desktop navigation model, and make every option-selection control feel like part of the same product instead of relying on browser-native `<select>` menus.

This round has four coordinated outcomes:

1. Replace the current mobile horizontal sidebar/navigation strip with a fixed bottom navigation bar plus a `Mais` sheet.
2. Add horizontal swipe navigation between the six main application sections on mobile.
3. Keep order elapsed-time indicators current automatically, including immediately after the app returns from the background.
4. Replace all native `<select>` controls with one reusable system selection component that adapts its presentation to desktop and mobile.

## Scope boundaries

This design standardizes **selection lists/dropdowns**, not record lists such as the client list, order queue, product list, or financial movement history.

The searchable client picker in New Order remains a specialized searchable combobox because its interaction is different from a small fixed option set. Its popup should reuse the same visual tokens as the new system selection surface where practical, but it is not converted into the non-searchable selector component.

The date picker remains a native date input. The existing theme segmented control remains a segmented control; on mobile it is exposed inside the `Mais` sheet rather than converted into a selector.

No backend, D1 schema, API, authentication, payment, pricing, or order workflow semantics change in this round.

## 1. Mobile navigation

### Desktop

Desktop keeps the existing left sidebar and all current navigation behavior. The new bottom navigation is mobile-only.

### Mobile bottom bar

At the mobile breakpoint (`max-width: 820px`, matching the current sidebar mobile breakpoint), replace the horizontal sidebar navigation with a fixed bottom bar.

The bar has five equal destinations:

- Dashboard
- Pedidos
- Clientes
- Produtos
- Mais

Each destination shows an icon and a short text label. The active main destination has the existing primary accent treatment. If the active section is `A Receber` or `Financeiro`, the `Mais` destination is shown as active so the user still has a visible location cue.

The bottom bar must:

- stay visible while content scrolls;
- respect `env(safe-area-inset-bottom)` on devices with a home indicator;
- have touch targets at least 44px high;
- never cover page content or floating actions; mobile page content receives enough bottom padding for the bar plus safe area;
- preserve the Dashboard floating `Novo pedido` action above the navigation bar.

### `Mais` sheet

Tapping `Mais` opens a system-styled bottom sheet over a dimmed backdrop. It contains:

- A Receber
- Financeiro
- Tema: the existing Claro / Escuro / Automático segmented control
- Sair do sistema

Choosing `A Receber` or `Financeiro` navigates and closes the sheet. `Sair do sistema` uses the existing logout action and disabled/loading behavior. Theme changes keep the existing persisted theme behavior.

The sheet closes when the user taps the backdrop or its explicit close control. It is announced as a dialog for accessibility and traps interaction inside while open.

The current mobile-only top `Sair` workaround introduced for the previous responsive bug is removed after the `Mais` sheet provides a permanent logout location.

## 2. Swipe navigation on mobile

The main mobile sections form one ordered navigation sequence:

`Dashboard → Pedidos → Clientes → Produtos → A Receber → Financeiro`

A horizontal swipe on the main page content moves one section at a time:

- swipe left: next section;
- swipe right: previous section;
- no wraparound at either end.

The bottom bar updates immediately to reflect the destination; for `A Receber` and `Financeiro`, `Mais` becomes active.

### Gesture safety

Swipe navigation is an accelerator, not the only way to navigate. Buttons and the `Mais` sheet remain authoritative navigation controls.

To prevent accidental navigation:

- require a meaningful horizontal distance before treating the gesture as navigation;
- require horizontal movement to dominate vertical movement;
- ignore gestures that start inside inputs, textareas, buttons, links, dialogs, listboxes, or elements explicitly marked as horizontally interactive;
- disable section swipe while a modal, selector surface, or `Mais` sheet is open;
- disable section swipe on the `new-order` screen so building an order cannot be lost through an accidental page gesture.

The gesture changes the active section only; it does not animate or physically drag the whole page between routes in this iteration.

## 3. Live order elapsed time

The Orders screen already recalculates its `now` state every 60 seconds. Keep that one-minute cadence because the UI displays minutes/hours and second-level updates would add work without useful information.

Add immediate recalculation when the application becomes active again:

- on document `visibilitychange` when visibility returns to `visible`;
- on window `focus`.

This refreshes elapsed labels and timing state (`No prazo`, `Atrasado`, `Muito atrasado`) immediately after the user unlocks the phone, returns from another app, or switches back to the browser tab.

This is a local clock refresh only. It does not poll the backend every minute and does not introduce background network traffic.

## 4. Unified system selector

### Component contract

Create one reusable selection component, tentatively `SystemSelect`, for small fixed option sets.

It accepts at minimum:

- current `value`;
- `options` containing value and label;
- `onChange`;
- `disabled`;
- accessible label/identifier;
- optional placeholder where needed.

The trigger looks like the existing form controls and shows the selected label plus a chevron. The selected option is visibly marked in the option surface.

### Desktop presentation

On desktop, opening the selector displays a compact custom dropdown anchored below the field. It uses the system surface, border, radius, shadow, hover, focus, selected-state, and light/dark theme variables.

The dropdown closes after selection, on outside interaction, or Escape.

Keyboard support includes opening from the trigger, arrow-key movement through options, Enter/Space selection, and Escape to close. Roles/state follow combobox/listbox semantics so native select accessibility is not lost.

### Mobile presentation

At the mobile breakpoint, the same component opens its options as a bottom selection sheet using the same design language as other system modals. Options are full-width touch-friendly rows with the current option clearly selected.

The mobile selection sheet:

- uses a dimmed backdrop;
- respects safe areas;
- supports backdrop/close dismissal;
- has at least 44px option rows;
- uses the same options and `onChange` contract as desktop so business logic is not duplicated.

Selection closes the sheet immediately.

### Native selects to replace

The current native option controls identified in the application are all migrated to the shared selector:

- New Order: Tipo do pedido (`Entrega`, `Retirada`, `Consumo no local`).
- New Order checkout: Ajuste do pedido (`Nenhum`, `Desconto`, `Acréscimo`).
- New Order checkout: Modo do ajuste (`R$`, `%`).
- New Order checkout: Forma de pagamento.
- Receivables payment modal: Forma de pagamento.
- Clients: Ordenar (`Nome A–Z`, `Nome Z–A`).
- Product modal: Categoria (`Marmita`, `Bebida`, `Doce`, `Adicional`).
- Financial movement modal: Tipo (`Entrada`, `Saída`).
- Financial movement modal: Categoria (`Vendas`, `Delivery`, `Insumos`, `Despesas`, `Outros`).

Implementation must also run a repository-wide check for remaining JSX `<select>` elements. Any remaining application-facing native select discovered during that check is migrated in this same round unless it is deliberately documented as out of scope.

## 5. Component and styling structure

Expected new focused units:

- `src/components/MobileNavigation.jsx` (bottom bar and `Mais` interaction boundary, or equivalent split into two small components if clearer);
- `src/components/SystemSelect.jsx`;
- focused CSS files for mobile navigation and selector surfaces rather than expanding `App.css` further;
- a small swipe helper/hook or utility if gesture handling would otherwise make `App.jsx` harder to understand.

Existing components keep business ownership:

- `App.jsx` remains the source of `activeTab`, navigation actions, logout, modal state, payment state, product/movement form state;
- `Sidebar.jsx` remains desktop navigation and desktop footer/theme/logout;
- `Orders.jsx` remains responsible for order timing display;
- `ThemeProvider` remains responsible for persisted theme state.

The new components receive callbacks/state instead of duplicating business logic.

## 6. Accessibility and interaction requirements

- Mobile navigation uses a navigation landmark and `aria-current="page"` on the active destination.
- `Mais` and mobile selection sheets expose dialog semantics and a clear accessible name.
- System selector exposes the current value and expanded state to assistive technology.
- Keyboard users on desktop can fully operate selectors without a mouse.
- Focus returns to the triggering control after a sheet/dropdown closes where practical.
- Disabled states remain visible and non-interactive.
- Theme contrast and focus-visible styling work in both light and dark themes.

## 7. Responsive and visual requirements

- No horizontal menu scrolling is required for navigation on mobile.
- No navigation destination is hidden or unreachable.
- The mobile bottom bar fits common narrow widths without text overflow.
- `Mais`, selection sheets, and other overlays stack above the bottom bar.
- Main content and Dashboard floating action are offset so fixed navigation never covers interactive content.
- Desktop left sidebar layout and desktop page widths remain unchanged.

## 8. Testing strategy

Implementation follows TDD. Tests are added before behavior changes and must first fail for the missing behavior.

Coverage includes:

1. Mobile bottom navigation contains the four direct destinations plus `Mais`, while all six sections remain reachable.
2. `Mais` exposes A Receber, Financeiro, theme controls, and logout.
3. Main content includes bottom spacing/safe-area handling and no mobile horizontal-nav dependency.
4. Swipe helper moves one section in the correct direction, respects boundaries, ignores short/vertical gestures, and can be disabled for interactive surfaces/new-order.
5. Orders keeps the 60-second refresh and also refreshes on visibility return/focus.
6. `SystemSelect` renders selected state, options, disabled behavior, and accessible semantics.
7. Responsive selector CSS provides desktop dropdown and mobile sheet presentation.
8. Every application-facing native JSX `<select>` is removed or explicitly documented as an approved exception; expected target after this round is zero native `<select>` elements in application JSX.
9. Existing order checkout, payment, product, movement, sorting, theme, and navigation tests continue to pass.
10. Full `npm test`, `npm run lint`, `npm run build`, and Wrangler dry-run pass before integration.

## 9. Non-goals

This round does not:

- add new business sections;
- change order/payment values or validation rules;
- add new payment methods, product categories, or movement categories;
- introduce backend polling or push notifications;
- add animated page-carousel routing;
- redesign desktop navigation;
- redesign data-table/list rows merely because they are lists of records.

## Acceptance criteria

The round is complete when a mobile user can reach every main section without horizontal menu scrolling, can navigate sections by deliberate swipe, can always reach theme/logout through `Mais`, sees order elapsed time catch up immediately after returning to the app, and encounters the same system-owned selection experience anywhere a fixed choice list is used. Desktop retains its sidebar while all fixed-choice selectors use the consistent custom dropdown presentation.