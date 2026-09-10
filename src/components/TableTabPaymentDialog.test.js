import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText, buttonNamed } from '../test-support/renderWorkspace.js'
import { comandaDetail, deferred } from '../test-support/comandaFixtures.js'

test('mounted mobile payment and method sheet release locks together and preserve nested focus', async (t) => {
  const h = await workspaceHarness(t, { mobile: true })
  const { default: Dialog } = await h.load('/src/components/TableTabPaymentDialog.jsx')
  h.document.body.style.overflow = 'scroll'
  const focusable = (name) => ({ name, focus() { h.document.activeElement = this } })
  const launcher = focusable('payment launcher')
  launcher.focus()
  const overlays = new Map()
  let combobox, renderer
  const props = { open: true, detail: comandaDetail, currency: String, onClose() {}, onConfirm() {} }
  renderer = await h.render(Dialog, props, { createNodeMock(element) {
    if (element.props.role === 'combobox') { combobox = focusable('method trigger'); return combobox }
    if (element.props.role === 'dialog') {
      const control = focusable(element.props['aria-label'])
      const overlay = { querySelectorAll: () => [control] }
      overlays.set(element.props['aria-label'], overlay)
      return overlay
    }
    return null
  } })
  h.document.querySelectorAll = () => renderer.root.findAll((node) => typeof node.type === 'string' && node.props.role === 'dialog').map((node) => overlays.get(node.props['aria-label']))
  combobox.focus()
  await act(async () => renderer.root.findByProps({ role: 'combobox' }).props.onClick())
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 2)
  assert.equal(h.document.activeElement.name, 'Forma de pagamento')
  await act(async () => h.document.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' })))
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 1, 'Escape closes only the top sheet')
  assert.equal(h.document.activeElement, combobox)
  assert.equal(h.document.body.style.overflow, 'hidden')
  await act(async () => renderer.root.findByProps({ role: 'combobox' }).props.onClick())
  await act(async () => renderer.update(React.createElement(Dialog, { ...props, open: false })))
  assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0)
  assert.equal(h.document.body.style.overflow, 'scroll', 'closing payment with its sheet open must release both locks')
})

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
