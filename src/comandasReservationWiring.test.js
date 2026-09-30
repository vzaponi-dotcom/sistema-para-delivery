import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')

test('App composes reservation commands and routes Editar reserva into the shared New Order wizard', () => {
  assert.match(app, /useTableReservationCommands/)
  assert.match(app, /const reservationCommands = useTableReservationCommands\(/)
  assert.match(app, /newOrderDraft\.openReservationEdit\(detail, \{ returnDestination: 'comandas' \}\)/)
  assert.match(app, /completeNavigation\('new-order'\)/)
  assert.match(app, /onEditReservation=\{handleEditReservation\}/)
  assert.match(app, /onConfirmReservationArrival=\{reservationCommands\.confirmArrival\}/)
  assert.match(app, /onCancelReservation=\{reservationCommands\.cancelReservation\}/)
  assert.match(app, /onMarkReservationNoShow=\{reservationCommands\.markNoShow\}/)
  assert.match(app, /canCancelOrders=\{canCancelOrders\}/)
  assert.match(app, /cancellationOptions=\{cancellationOptions\}/)
  assert.match(app, /cancellationRevision=\{cancellationRevision\}/)
  assert.match(app, /currentTiming=\{currentTiming\}/)
})

test('arrival command result selects the authoritative newly-opened comanda instead of bypassing conversion', () => {
  assert.match(app, /onResult:\s*\(result, action\)/)
  assert.match(app, /action !== 'arrival'/)
  assert.match(app, /result\?\.tableTab\?\.id/)
  assert.match(app, /resolveOpenComanda\(result\.tables/)
  assert.match(app, /selectComanda\(identity, result\.tables\)/)
})
