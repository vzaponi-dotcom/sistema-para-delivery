import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText, buttonNamed } from '../test-support/renderWorkspace.js'
import { comandaDetail, deferred } from '../test-support/comandaFixtures.js'

for (const mobile of [false, true]) test(`full payment dialog uses official methods and prevents duplicate submission (${mobile ? 'mobile' : 'desktop'})`, async (t) => {
  const h = await workspaceHarness(t, { mobile })
  const { default: Dialog } = await h.load('/src/components/TableTabPaymentDialog.jsx')
  const pending = deferred(), calls = []
  const props = { open: true, detail: comandaDetail, currency: (v) => v.toFixed(2), onClose() {}, onConfirm: (...args) => { calls.push(args); return pending.promise } }
  const r = await h.render(Dialog, props)
  assert.match(nodeText(r.root), /123.45/)
  assert.equal(r.root.findAllByType('input').length, 0, 'no partial amount entry')
  assert.equal(nodeText(r.root.findByProps({ role: 'combobox' })), 'Pix')
  await act(async () => r.root.findByProps({ role: 'combobox' }).props.onClick())
  assert.deepEqual(r.root.findAllByProps({ role: 'option' }).map(nodeText), ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro'])
  await act(async () => buttonNamed(r.root, 'Dinheiro').props.onClick())
  const submit = r.root.findByType('form').props.onSubmit
  await act(async () => { void submit({ preventDefault() {} }); void submit({ preventDefault() {} }) })
  assert.deepEqual(calls, [['tab-42', 'Dinheiro']])
  assert.ok(buttonNamed(r.root, 'Confirmar pagamento').props.disabled)
  await act(async () => pending.resolve(false))
  assert.ok(!buttonNamed(r.root, 'Confirmar pagamento').props.disabled, 'failed payment permits retry')
  await act(async () => r.update(React.createElement(Dialog, { ...props, open: false })))
  await act(async () => r.update(React.createElement(Dialog, props)))
  assert.equal(nodeText(r.root.findByProps({ role: 'combobox' })), 'Pix')
  await act(async () => r.update(React.createElement(Dialog, { ...props, disabled: true })))
  await act(async () => r.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  assert.equal(calls.length, 1)
})
