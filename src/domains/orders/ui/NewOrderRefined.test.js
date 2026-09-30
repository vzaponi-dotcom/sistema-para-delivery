import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText, buttonNamed } from '../../../test-support/renderWorkspace.js'

const items = [{ lineId: 'line-note', productId: 'p1', name: 'Prato', quantity: 2, unitPrice: 18, category: 'Refeições', note: 'Sem cebola' }]
const currency = n => `R$ ${n.toFixed(2)}`

test('editable cart summary updates the exact line and keeps subtotal-only checkout', async t => {
  const h = await workspaceHarness(t)
  const { default: Summary } = await h.load('/src/domains/orders/ui/components/NewOrderCartSummary.jsx')
  const updates = []
  const screen = await h.render(Summary, { items, itemCount: 2, subtotal: 36, currency, cartProps: { items, currency, onUpdate: (...args) => updates.push(args), onNoteChange() {}, onNoteCommit() {}, onRemove() {} } })
  const add = screen.root.findAllByType('button').find(b => b.props['aria-label'] === 'Aumentar quantidade de Prato')
  assert.ok(add, 'summary must expose quantity editing')
  await act(async () => add.props.onClick())
  assert.deepEqual(updates, [['line-note', { quantity: 3 }]])
  assert.match(nodeText(screen.root), /Sem cebola/)
  assert.doesNotMatch(nodeText(screen.root), /Taxa de entrega|Salvar pedido/)
})

test('mobile catalog cart opens for edits without advancing the wizard', async t => {
  const h = await workspaceHarness(t)
  const { default: Products } = await h.load('/src/domains/orders/ui/components/NewOrderProductsStep.jsx')
  let reviewed = 0
  const screen = await h.render(Products, { products: [], items, currency, itemCount: 2, subtotal: 36, cartProps: { items, currency }, onReview: () => reviewed++ })
  const trigger = buttonNamed(screen.root, 'Ver carrinho')
  assert.ok(trigger)
  await act(async () => trigger.props.onClick())
  assert.equal(reviewed, 0)
  assert.equal(screen.root.findAllByProps({ role: 'dialog' }).length, 1)
})

test('review separates adjustment controls from totals and respects adjustment permission', async t => {
  const h = await workspaceHarness(t)
  const { default: Review } = await h.load('/src/domains/orders/ui/components/NewOrderReviewStep.jsx')
  const checkoutProps = { draft: { type: 'Entrega', deliveryFee: '5,00', adjustment: { type: 'none', mode: 'fixed', value: '', reason: '' } }, preview: { subtotal: 36, deliveryFee: 5, total: 41 }, currency, canSubmit: true }
  const screen = await h.render(Review, { customerSummary: 'Marina', itemCount: 2, cartProps: { items, currency }, checkoutProps, canAdjustOrders: false })
  const fields = screen.root.findAll(n => n.type === 'div' && n.props.className === 'new-order-review-fields')
  assert.equal(fields.length, 1)
  assert.match(nodeText(fields[0]), /Taxa de entrega/)
  assert.equal(fields[0].findAllByProps({ role: 'combobox' }).length, 0)
  assert.match(nodeText(screen.root), /Salvar pedido/)
})

test('mobile cart retains its focus lifecycle while a note is typed', async t => {
  const h = await workspaceHarness(t)
  const { default: Products } = await h.load('/src/domains/orders/ui/components/NewOrderProductsStep.jsx')
  const { default: BottomSheet } = await h.load('/src/shared/ui/BottomSheet.jsx')
  const props = { products: [], items, currency, itemCount: 2, subtotal: 36, cartProps: { items, currency } }
  const screen = await h.render(Products, props)
  await act(async () => buttonNamed(screen.root, 'Ver carrinho').props.onClick())
  const close = screen.root.findByType(BottomSheet).props.onClose
  const edited = items.map(item => ({ ...item, note: 'Sem cebola e sem sal' }))
  await act(async () => screen.update(React.createElement(Products, { ...props, items: edited, cartProps: { items: edited, currency } })))
  assert.equal(screen.root.findByType(BottomSheet).props.onClose, close, 'typing must not reset sheet focus')
})

test('compact cart removes only the chosen single-quantity line among note variants', async t => {
  const h = await workspaceHarness(t)
  const { default: Cart } = await h.load('/src/domains/orders/ui/components/OrderCart.jsx')
  const variants = [
    { ...items[0], lineId: 'without-onion', quantity: 1 },
    { ...items[0], lineId: 'without-salt', quantity: 1, note: 'Sem sal' },
  ]
  const removed = []
  const updates = []
  const screen = await h.render(Cart, { items: variants, compact: true, currency, onRemove: id => removed.push(id), onUpdate: (...args) => updates.push(args) })
  const minus = screen.root.findAllByType('button').filter(b => b.props['aria-label'] === 'Diminuir quantidade de Prato')
  await act(async () => minus[1].props.onClick())
  assert.deepEqual(removed, ['without-salt'])
  assert.deepEqual(updates, [])
})
