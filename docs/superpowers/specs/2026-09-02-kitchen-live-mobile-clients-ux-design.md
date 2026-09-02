# Kitchen Live, Mobile Motion, FAB and Clients UX Design

## Goal

Improve the daily delivery operation with near-real-time kitchen updates, a short new-order alert, smoother mobile navigation, a correctly positioned new-order FAB, and a denser phonebook-style client list.

## Kitchen live refresh

The orders screen must refresh its order data while it is visible without requiring a page reload. Use a dedicated authenticated `GET /api/orders` endpoint instead of polling the full bootstrap payload. Poll every 2 seconds only while the `orders` tab is active and the browser is online; also refresh immediately when the document becomes visible or the window regains focus.

The initial load/first refresh establishes the known order IDs and must not play a sound. Subsequent refreshes compare the latest active order IDs with the known set. A newly discovered active order gets a short visual entrance/highlight and triggers one notification sound. The same order must never alert twice during the session.

Sound is enabled by default, persisted in localStorage, and can be toggled from the kitchen header. Browser autoplay restrictions are handled by attempting playback only after normal user interaction; a rejected playback must not break polling or the UI.

## Mobile page motion

Existing swipe navigation remains the navigation mechanism. When the active mobile section changes, the content wrapper receives a short horizontal transition (about 200 ms) whose direction follows the destination relative to the current mobile section. Respect `prefers-reduced-motion` by disabling the animation.

No animation library is added.

## Dashboard new-order FAB

The dashboard FAB must remain above the fixed mobile navigation, including devices with a bottom safe area. The stacking order is content < mobile navigation < FAB < modal/bottom sheet. The FAB offset must derive from the navigation height/safe-area rather than overlap the bar.

## Clients phonebook layout

Replace avatar-heavy client cards with compact full-width rows containing name, phone and a subdued address. The entire row opens an action bottom sheet for that client. The sheet offers Edit and Delete actions. Delete requires explicit confirmation before calling the existing delete handler.

Search remains unchanged. Default sorting remains alphabetical A-Z and the existing sort control can stay available. Client create/edit remains in the existing modal managed by `App`.

## Error handling

Polling failures are silent when they are transient: existing order data stays rendered and the next interval retries. A 401 follows the existing session-expiration behavior. Sound playback failures are ignored after preserving the known-ID state so they cannot cause repeated alerts.

## Testing

Add source/behavior tests covering the new orders endpoint wiring, polling cadence and visibility refresh, one-time new-order detection/sound semantics, reduced-motion page transitions, FAB mobile offset/z-index, and compact client bottom-sheet actions with delete confirmation. Run the repository validation workflow (`npm test`, lint, build and Worker dry-run).