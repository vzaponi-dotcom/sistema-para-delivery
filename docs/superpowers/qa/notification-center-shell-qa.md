# Notification Center and Operation Shell QA

## Automated

- Executable SHA: `81deae896c132a7d04832b950016b198ed8892e7`
- Full `node --test`: PASS — 2,072 tests, 0 failures.
- Architecture: PASS — frontend architecture boundaries OK.
- Lint: PASS — 0 errors; warnings reported by the existing lint configuration.
- Build: PASS — Vite transformed 520 modules.
- Local D1: PASS — no migrations to apply.
- Worker production dry-run: PASS — Wrangler 4.128.0 exited in dry-run mode.
- Worker staging dry-run: PASS — Wrangler 4.128.0 exited in dry-run mode.
- `git diff --check`: PASS.
- New migrations: 0.

The automated checks ran in the order specified by the implementation plan. The complete suite and all later gates used the executable SHA above. Two review findings were corrected with a focused RED → GREEN cycle before the final full run: invalid release sections are excluded from the catalog, and notification item labels announce read state.

## Staging manual checklist

Staging deployment and manual checks are pending explicit authorization.

### Desktop

- [ ] Top bar visible in Pedidos, Comandas, Financeiro, Clientes and Configurações.
- [ ] Top bar absent from login/loading screens.
- [ ] Pedidos badge increments/decrements with operational orders.
- [ ] Future scheduled order does not count before preparation window.
- [ ] Comandas badge increments on open and decrements on payment/close.
- [ ] Comanda transfer keeps the same count.
- [ ] Bell unread count and 99+ visual cap.
- [ ] Notification drawer opens/closes and restores focus.
- [ ] Release detail opens above drawer.
- [ ] AS menu shortcuts respect capabilities.
- [ ] Light and dark themes at ~1024, 1280 and 1440 px.

### Mobile

- [ ] Compact top bar at ~320–390 px.
- [ ] Pedidos and Comandas badges fit the bottom navigation.
- [ ] Bell opens BottomSheet.
- [ ] Selecting a notification swaps list → detail in the same sheet.
- [ ] Back returns detail → list.
- [ ] Automatic release notice appears once per device.
- [ ] Closing automatic notice keeps it unread but prevents auto-reopen.
- [ ] Entendi marks it read.
- [ ] Logout/login preserves notification state on the same device.

## Production

- NOT DEPLOYED.
- Merge requires explicit authorization.
