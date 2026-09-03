import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./OrderHistory.jsx', import.meta.url), 'utf8').catch(() => '')

test('history owns terminal orders and exposes all finalized cancelled filters', () => {
  assert.match(source, /isOrderFinished/)
  assert.match(source, /Todos/)
  assert.match(source, /Finalizados/)
  assert.match(source, /Cancelados/)
})

test('cancelled history shows reason and refund state', () => {
  assert.match(source, /cancelReason/)
  assert.match(source, /getOrderRefundState/)
  assert.match(source, /Estorno pendente/)
  assert.match(source, /Estornado/)
})

test('only finalized orders expose cancellation action', () => {
  assert.match(source, /status === 'Finalizado'/)
  assert.match(source, /Cancelar pedido/)
  assert.doesNotMatch(source, /Reativar pedido/)
})
