# Notification Center and Operation Shell QA

## Final product state

- Final executable SHA: `84ca50252a786e1ad90d9f790fdd9d7dddaa652c`
- Pull request: #61
- Production: **NOT DEPLOYED**
- Merge: **NOT AUTHORIZED**

## Automated validation

Final GitHub Actions evidence:

- Validate #1738 / run `35770425761`: **SUCCESS**
- 8/8 test shards: **SUCCESS**
- aggregated `validate` job: **SUCCESS**

The final validation ran against the exact executable SHA above.

The feature remained migration-free. Later polish cycles preserved the previously approved application, worker, architecture, lint, build and D1 gates while adding focused RED → GREEN coverage for navigation, badges, notification behavior, reusable release notes and desktop sidebar layout.

## Manual staging QA

Manual homologation was completed cumulatively in staging from #200 through #212.

### Notifications

- [x] Automatic release notice appears on first entry for the device.
- [x] `Entendi` closes the notice and marks the release as read.
- [x] Reloading does not reopen an already presented automatic notice.
- [x] Notification Center preserves the release in history.
- [x] Read items no longer remain in the unread badge.
- [x] Logout/login on the same device preserves local notification state.
- [x] Desktop Notification Center: PASS.
- [x] Mobile Notification Center: PASS.
- [x] Mobile detail uses the BottomSheet close action; the former large `Voltar` button remains removed.
- [x] Closing detail and reopening the Center returns to the list with the notification already read.

### Reusable release notes presentation

- [x] Minimalist premium release-notes layout approved on desktop.
- [x] Release summary, semantic item list, configured icons, fallback icon and subtle dividers approved.
- [x] Release notes render from structured catalog data without release-specific JSX changes.
- [x] Light and dark themes approved.
- [x] Mobile wrapping/responsiveness approved without horizontal overflow.
- [x] Release-note icon container is vertically centered against multi-line copy.
- [x] Redundant “Este aviso será exibido apenas uma vez neste dispositivo.” copy is removed.
- [x] `Entendi` and `Ver histórico` remain unchanged.
- [x] Presented/read persistence behavior remains unchanged.

### Global top bar and operation identity

- [x] Mobile premium top bar approved at compact height.
- [x] Desktop top bar approved full-width.
- [x] Operation identity is sourced from `business.name`, without hardcoded Amor & Sabor in the shell.
- [x] Operation menu desktop: PASS.
- [x] Operation menu mobile: PASS.
- [x] Mobile keeps Gestão Delivery as the product brand while the operation chip uses the real business initials.

### Operational badges

Pedidos:
- [x] Active operational orders increment the badge.
- [x] Finalizing an order decrements the badge.
- [x] Zero hides the badge.
- [x] Future scheduled orders outside the operational window do not count.
- [x] Desktop/mobile behavior is consistent.

Comandas:
- [x] Opening a comanda increments the badge.
- [x] Paying/closing decrements the badge.
- [x] Zero hides the badge.
- [x] Transferring the same comanda between tables does not change the total.
- [x] Desktop/mobile behavior is consistent.

Print queue:
- [x] Active print-job count is shown in the desktop sidebar.
- [x] The same count is shown on the Pedidos → Fila de impressão action.
- [x] Count comes from the existing authoritative queue summary.
- [x] Existing printing-manager refresh/polling is reused; no extra polling was introduced.
- [x] Zero hides the badge.

### Navigation and sidebar polish

- [x] Changing tabs resets the content scroll to the top.
- [x] Sidebar follows light/dark theme.
- [x] Configurações and Sair do sistema are absent from the sidebar and remain available from the top-bar operation menu.
- [x] Desktop groups retain compact natural height and do not stretch vertically.
- [x] Premium group hierarchy/dividers approved.
- [x] Badge sits above the icon with the approved subtle offset.
- [x] Badge does not sit between icon and text.
- [x] Text alignment is identical for rows with and without badges.
- [x] Mobile remains visually unchanged: PASS.

## Final QA status

- Automated validation: **PASS**
- Staging deployment: **PASS**
- Manual desktop QA: **PASS**
- Manual mobile QA: **PASS**
- Final staging: **#212**
- Final staging run: `35770758391`
- Final executable SHA: `84ca50252a786e1ad90d9f790fdd9d7dddaa652c`
- Production: **NOT DEPLOYED**
- Merge requires explicit authorization.
