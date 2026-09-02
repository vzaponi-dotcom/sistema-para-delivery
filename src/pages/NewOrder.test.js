import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import NewOrder from './NewOrder.jsx'

const currency = (value) => `R$ ${Number(value || 0).toFixed(2)}`

test('new order screen exposes client, catalog, cart and both checkout actions', () => {
  const html = renderToStaticMarkup(React.createElement(NewOrder, {
    clients: [{ id: 'c1', name: 'Maria', phone: '(11) 99999-9999' }],
    products: [{ id: 'p1', name: 'Marmita G', category: 'Marmita', size: 'G', price: 32 }],
    currency,
    disabled: false,
    onCancel: () => {},
    onCreateClient: async () => null,
    onSubmit: async () => false,
  }))

  assert.match(html, /Nova venda/)
  assert.match(html, /Maria/)
  assert.match(html, /Buscar produto/)
  assert.match(html, /Marmita/)
  assert.match(html, /Carrinho/)
  assert.match(html, /Salvar pedido/)
  assert.match(html, /Salvar e receber/)
})
