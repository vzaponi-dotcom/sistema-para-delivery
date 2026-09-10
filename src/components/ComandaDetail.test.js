import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText, buttonNamed } from '../test-support/renderWorkspace.js'
import { comandaDetail } from '../test-support/comandaFixtures.js'

test('consolidated detail renders official payable total, quantities, unit prices, variations and counts', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Detail } = await h.load('/src/components/ComandaDetail.jsx')
  const actions = []
  const r = await h.render(Detail, { detail: comandaDetail, currency: (v) => `R$ ${v.toFixed(2)}`, onAddOrder: () => actions.push('add'), onViewTicket: () => actions.push('view'), onPrint: () => actions.push('print'), onPay: () => actions.push('pay') })
  const text = nodeText(r.root)
  for (const value of ['Comanda 42', 'Mesa 7', '2 pedidos', '3 itens', '2x X-Bacon', '1x X-Bacon', 'Grande / queijo extra', 'Sem cebola', 'R$ 25.00', 'R$ 50.00', 'R$ 123.45']) assert.ok(text.includes(value), value)
  assert.equal(r.root.findByType('time').props.dateTime, '2026-09-10T12:30:00Z')
  assert.equal(r.root.findAllByType('button').length, 4)
  await act(async () => {
    buttonNamed(r.root, 'Adicionar pedido').props.onClick()
    buttonNamed(r.root, 'Ver ticket').props.onClick()
    buttonNamed(r.root, 'Imprimir comanda').props.onClick()
    buttonNamed(r.root, 'Registrar pagamento').props.onClick()
  })
  assert.deepEqual(actions, ['add', 'view', 'print', 'pay'])
})

for (const state of ['readonly', 'closed', 'empty']) test(`detail handles ${state} honestly`, async (t) => {
  const h = await workspaceHarness(t)
  const { default: Detail } = await h.load('/src/components/ComandaDetail.jsx')
  const detail = { ...comandaDetail, ...(state === 'closed' ? { status: 'closed' } : state === 'empty' ? { items: [], orderCount: 0, itemCount: 0, totalCents: 0 } : {}) }
  let calls = 0
  const r = await h.render(Detail, { detail, disabled: state === 'readonly', currency: String, onAddOrder: () => calls++, onPay: () => calls++ })
  if (state === 'empty') {
    assert.match(nodeText(r.root), /Nenhum item/)
    assert.ok(buttonNamed(r.root, 'Registrar pagamento').props.disabled)
    assert.ok(!buttonNamed(r.root, 'Adicionar pedido').props.disabled)
  } else {
    for (const button of r.root.findAllByType('button')) {
      assert.ok(button.props.disabled)
      await act(async () => button.props.onClick())
    }
    assert.equal(calls, 0)
    assert.match(nodeText(r.root), state === 'closed' ? /encerrada/i : /consulta/i)
  }
})
