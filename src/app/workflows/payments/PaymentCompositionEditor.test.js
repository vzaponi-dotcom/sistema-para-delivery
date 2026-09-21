import test from 'node:test'
import assert from 'node:assert/strict'
import React, { useState } from 'react'
import { act } from 'react-test-renderer'
import { buttonNamed, nodeText, workspaceHarness } from '../../../test-support/renderWorkspace.js'

const options = [
  { code: 'pix', value: 'Pix', label: 'Pix' },
  { code: 'cash', value: 'Dinheiro', label: 'Dinheiro' },
]

test('payment composition editor adds/removes rows and closes a Dinheiro + Pix composition accessibly', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Editor } = await h.load('/src/app/workflows/payments/PaymentCompositionEditor.jsx')
  let latest = null

  function Harness() {
    const [allocations, setAllocations] = useState([{ methodCode: 'cash', amountCents: 8000 }])
    latest = allocations
    return React.createElement(Editor, {
      totalCents: 8000,
      allocations,
      onChange: setAllocations,
      paymentOptions: options,
      disabled: false,
    })
  }

  const screen = await h.render(Harness)
  assert.equal(nodeText(screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma de pagamento' })), 'Dinheiro')
  assert.equal(screen.root.findByProps({ 'aria-label': 'Valor da forma de pagamento 1' }).props.inputMode, 'decimal')
  assert.match(nodeText(screen.root), /Total a receber.*R\$ 80,00/s)
  assert.match(nodeText(screen.root), /Restante.*R\$ 0,00/s)

  await act(async () => buttonNamed(screen.root, 'Adicionar outra forma').props.onClick())
  assert.equal(latest.length, 2)
  assert.equal(screen.root.findAllByProps({ role: 'combobox' }).length, 2)
  assert.equal(latest[1].amountCents, 0, 'when the first method already covers the total there is no remainder')

  let amountInputs = screen.root.findAll((node) => node.type === 'input' && String(node.props?.['aria-label'] || '').startsWith('Valor da forma de pagamento'))
  await act(async () => amountInputs[0].props.onChange({ target: { value: 'R$ 30,00' } }))
  assert.equal(latest[1].amountCents, 5000, 'the newly added form follows the exact remaining amount')

  const secondSelect = screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma de pagamento 2' })
  await act(async () => secondSelect.props.onClick())
  await act(async () => buttonNamed(screen.root, 'Pix').props.onClick())

  amountInputs = screen.root.findAll((node) => node.type === 'input' && String(node.props?.['aria-label'] || '').startsWith('Valor da forma de pagamento'))
  await act(async () => amountInputs[1].props.onChange({ target: { value: 'R$ 50,00' } }))

  assert.deepEqual(latest, [
    { methodCode: 'cash', amountCents: 3000 },
    { methodCode: 'pix', amountCents: 5000 },
  ])
  assert.match(nodeText(screen.root), /Total informado.*R\$ 80,00/s)
  assert.match(nodeText(screen.root), /Restante.*R\$ 0,00/s)

  const secondSystemSelect = screen.root.findByProps({ role: 'combobox', 'aria-label': 'Forma de pagamento 2' })
  await act(async () => secondSystemSelect.props.onClick())
  assert.equal(buttonNamed(screen.root, 'Dinheiro'), undefined, 'the method already used by another row is not offered twice')
  await act(async () => secondSystemSelect.props.onClick())

  await act(async () => screen.root.findByProps({ 'aria-label': 'Remover forma de pagamento 2' }).props.onClick())
  assert.deepEqual(latest, [{ methodCode: 'cash', amountCents: 3000 }])
  assert.match(nodeText(screen.root), /Restante.*R\$ 50,00/s)
})


test('payment composition editor renders the approved payment hierarchy with cards, icons and summary rows', async (t) => {
  const h = await workspaceHarness(t)
  const { default: Editor } = await h.load('/src/app/workflows/payments/PaymentCompositionEditor.jsx')

  const screen = await h.render(Editor, {
    totalCents: 8000,
    allocations: [
      { methodCode: 'cash', amountCents: 3000 },
      { methodCode: 'pix', amountCents: 5000 },
    ],
    onChange() {},
    paymentOptions: options,
    disabled: false,
  })

  assert.equal(screen.root.findAllByProps({ className: 'payment-composition-line' }).length, 2)
  assert.equal(screen.root.findAllByProps({ className: 'payment-composition-method-icon' }).length, 2)
  assert.ok(screen.root.findByProps({ className: 'payment-composition-heading' }))
  assert.ok(screen.root.findByProps({ className: 'payment-composition-summary' }))
  assert.match(nodeText(screen.root), /Como o cliente vai pagar\?/)
  assert.match(nodeText(screen.root), /Total a receber.*R\$ 80,00/s)
  assert.match(nodeText(screen.root), /Total informado.*R\$ 80,00/s)
  assert.match(nodeText(screen.root), /Restante.*R\$ 0,00/s)
  assert.ok(screen.root.findByProps({ 'aria-label': 'Remover forma de pagamento 2' }))
})
