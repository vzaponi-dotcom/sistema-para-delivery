import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { operationalEditAckKey, isOperationalEditPending, rememberOperationalEditAck } from './orderEditAcknowledgement.js'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('only a confirmed operational revision is hidden, later revisions remain visible', () => {
  const first = { id: 'o334', operationalRevision: 3, editPending: true }
  const newEdit = { ...first, operationalRevision: 4 }
  const key = operationalEditAckKey(first)
  assert.equal(key, 'o334:3')
  assert.equal(isOperationalEditPending(first, new Set()), true)
  const accepted = rememberOperationalEditAck(new Set(), first)
  assert.equal(isOperationalEditPending(first, accepted), false)
  assert.equal(isOperationalEditPending(newEdit, accepted), true)
  assert.equal(isOperationalEditPending({ ...newEdit, editPending: false }, accepted), false)
})

test('duplicate confirmations are idempotent; missing revision does not conceal any edit', () => {
  const order = { id: 'o334', operationalRevision: 3, editPending: true }
  const first = rememberOperationalEditAck(new Set(), order)
  assert.equal(rememberOperationalEditAck(first, order), first)
  assert.equal(operationalEditAckKey({ id: 'o334', operationalRevision: 0 }), null)
  assert.equal(rememberOperationalEditAck(first, { id: 'o334' }), first)
})

test('kitchen shows success only after server acknowledgement, without awaiting full bootstrap', () => {
  const app = read('../../../App.jsx')
  const action = app.slice(app.indexOf('const handleAcknowledgeOrderEdit'), app.indexOf('const handleEditOrder'))
  const request = action.indexOf('await clientsForContext.orders.acknowledgeOrderEdit(')
  const feedback = action.indexOf("showSuccessMessage('Alteração confirmada pela cozinha')")
  const refresh = action.indexOf('void refreshBootstrapSilently()')
  assert.ok(request >= 0 && request < feedback && feedback < refresh, 'server → feedback → background refresh')
  assert.doesNotMatch(action, /await refreshBootstrapSilently\(\)/)
  assert.match(action, /refreshBootstrapSilently\(\)\.catch/)
})

test('confirmation updates Cozinha immediately but never hides a newer revision or a failed request', () => {
  const orders = read('./Orders.jsx')
  assert.match(orders, /const \[locallyAcknowledgedEdits, setLocallyAcknowledgedEdits\]/)
  assert.match(orders, /isOperationalEditPending\(entry\.order, locallyAcknowledgedEdits\)/)
  assert.match(orders, /if \(result !== false\) setLocallyAcknowledgedEdits/)
  assert.match(orders, /rememberOperationalEditAck\(current, entry\.order\)/)
  assert.match(orders, /aria-busy=\{pendingAction ===/)
})

test('Controle da TV sends feedback immediately after confirmation, before background reload', () => {
  const control = read('../../../app/surfaces/kitchen-tv-control/KitchenTvControlSurface.jsx')
  const action = control.slice(control.indexOf('const acknowledgeEdit = async'), control.indexOf('const openOrderActions'))
  const confirmed = action.indexOf("onFeedback?.('Leitura da alteração confirmada.')")
  const refresh = action.indexOf('void loadControl(true)')
  assert.ok(confirmed >= 0 && confirmed < refresh)
  assert.doesNotMatch(action, /await loadControl\(true\)/)
})

test('compact amber banner retains readable button and narrow-screen behavior', () => {
  const css = read('./order-edit-banner.css')
  assert.match(css, /\.kitchen-order-edit-banner\s*\{[^}]*width:\s*fit-content/s)
  assert.match(css, /background:\s*rgba\(245,\s*158,\s*11,/)
  assert.doesNotMatch(css, /padding:\s*10px/)
  assert.match(css, /min-height:\s*3[246]px/)
  assert.match(css, /@media\s*\(max-width:\s*520px\)/)
})
