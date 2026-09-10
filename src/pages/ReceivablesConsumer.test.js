import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { createServer } from 'vite'
import { getBusinessDate } from '../../shared/finance.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const textContent = (node) => JSON.stringify(node)
const nodeText = (node) => node.children.map((child) => typeof child === 'string' ? child : nodeText(child)).join('')

const order = (id, client, overrides = {}) => ({
  id,
  client,
  clientId: 'client-1',
  customerIdentityType: 'registered_client',
  total: 20,
  orderDate: getBusinessDate(),
  createdAt: `${getBusinessDate()}T12:00:00.000Z`,
  paymentStatus: 'Pendente',
  status: 'Finalizado',
  items: [],
  ...overrides,
})

test('A Receber renders only ordinary pending and paid orders from a mixed dataset', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  const { default: Receivables } = await vite.ssrLoadModule('/src/pages/Receivables.jsx')
  const hadWindow = Object.hasOwn(globalThis, 'window')
  const originalWindow = globalThis.window
  globalThis.window = {
    setInterval: () => 1,
    clearInterval: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  }
  const orders = [
    order('ordinary-pending', 'Cliente pendente'),
    order('table-pending', 'Mesa pendente', { clientId: null, customerIdentityType: 'table', tableTabId: 'tab-pending', total: 80 }),
    order('ordinary-paid', 'Cliente quitado', { paymentStatus: 'Pago', paidAt: '2026-09-10T12:00:00.000Z', total: 30 }),
    order('table-paid', 'Mesa quitada', { clientId: null, customerIdentityType: 'table', tableTabId: 'tab-paid', paymentStatus: 'Pago', paidAt: '2026-09-10T13:00:00.000Z', total: 90 }),
  ]
  let renderer

  try {
    await act(async () => {
      renderer = create(React.createElement(Receivables, {
        orders,
        currency: (value) => `R$ ${value.toFixed(2)}`,
        onRegisterPayment: () => {},
        onUpdatePaymentPromise: async () => true,
      }))
    })

    let rendered = textContent(renderer.toJSON())
    assert.match(rendered, /Cliente pendente/)
    assert.doesNotMatch(rendered, /Mesa pendente/)
    assert.match(rendered, /R\$ 20\.00/)

    const pendingRow = renderer.root.findAllByProps({ className: 'receivable-ledger-row' })[0]
    await act(async () => pendingRow.props.onClick())
    rendered = textContent(renderer.toJSON())
    assert.match(rendered, /Registrar recebimento/)
    assert.match(rendered, /Definir data prometida/)
    const paidTab = renderer.root.findAll((node) => node.props.onClick && nodeText(node) === 'Quitados')[0]
    await act(async () => paidTab.props.onClick())
    rendered = textContent(renderer.toJSON())
    assert.match(rendered, /Cliente quitado/)
    assert.doesNotMatch(rendered, /Mesa quitada/)
  } finally {
    if (hadWindow) globalThis.window = originalWindow
    else delete globalThis.window
    await vite.close()
  }
})
