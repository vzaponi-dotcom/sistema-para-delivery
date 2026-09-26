import test from 'node:test'
import assert from 'node:assert/strict'
import { getReportingOrderReference } from './reportingOrderReference.js'

test('reporting order reference preserves real numbers and gives unnumbered orders a stable non-fake identifier', () => {
  assert.deepEqual(getReportingOrderReference({ id: 'o1', order_number: 42 }), {
    compact: '#42',
    title: 'Pedido #42',
    aria: 'pedido 42',
    meta: null,
  })

  const missing = getReportingOrderReference({
    id: 'f9a1cb3b-d4fb-405f-b3ad-ca7027fa92a3',
    order_number: null,
  })
  assert.equal(missing.compact, 'Sem nº · f9a1cb3b')
  assert.equal(missing.title, 'Pedido sem número')
  assert.equal(missing.aria, 'pedido sem número f9a1cb3b')
  assert.equal(missing.meta, 'ID f9a1cb3b')
  assert.doesNotMatch(JSON.stringify(missing), /#null|null"/)
})
