import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

test('orders operation renders all items and exposes complete detail', () => {
  const orders = source('./Orders.jsx')
  const ticket = source('../components/KitchenTicket.jsx')
  const notes = source('../components/KitchenTicketNotes.jsx')
  const history = source('./OrderHistory.jsx')
  const detail = source('../components/OrderDetail.jsx')

  assert.match(orders, /<KitchenTicket/)
  assert.match(ticket, /buildKitchenItemSummary\(order\)/)
  assert.match(ticket, /KitchenTicketNotes/)
  assert.match(notes, /notes\.map/)
  assert.match(ticket, /Exibir detalhes/)
  assert.match(history, /getOrderItemsSummary\(order\)/)
  assert.match(detail, /Taxa de entrega/)
  assert.match(detail, /Forma de pagamento/)
  assert.match(detail, /Subtotal/)
  assert.match(detail, /Total/)
})

test('orders and detail render the complete product label including size', () => {
  const ticketUtils = source('../utils/kitchenTicket.js')
  const detail = source('../components/OrderDetail.jsx')

  assert.match(ticketUtils, /map\(getOrderItemDisplayName\)/)
  assert.match(detail, /getOrderItemDisplayName\(item\)/)
})

test('mobile final action is styled to keep long delivery text inside the button', () => {
  const ticket = source('../components/KitchenTicket.jsx')
  const css = source('../order-operations.css')

  assert.match(ticket, /getFinalActionLabel\(order\)/)
  assert.match(css, /\.kitchen-ticket-actions \.button\s*\{[^}]*white-space:\s*normal/s)
})

test('app order search uses the complete multi-item searchable text', () => {
  const app = source('../App.jsx')
  assert.match(app, /getOrderItemsSearchText\(order\)/)
})

test('focused kitchen ticket units preserve every item note without reviving the expandable item list', () => {
  const ticket = source('../components/KitchenTicket.jsx')
  const notes = source('../components/KitchenTicketNotes.jsx')

  assert.match(ticket, /KitchenTicketNotes/)
  assert.match(notes, /notes\.map/)
  assert.match(notes, /note\.text/)
  assert.doesNotMatch(ticket, /order-items-(?:toggle|list)/)
})

test('order details keep their semantic sections, item notes, and printing in the approved order', () => {
  const detail = source('../components/OrderDetail.jsx')
  const timing = source('../components/OrderDetailTiming.jsx')

  const sectionOrder = ['Resumo', 'Horários', 'Itens', 'Valores', 'Impressão']
  let previous = -1
  for (const label of sectionOrder) {
    const position = detail.indexOf(`>${label}<`)
    assert.ok(position > previous, `${label} must follow the preceding detail section`)
    previous = position
  }
  assert.match(detail, /item\.note && <span>↳ \{item\.note\}<\/span>/)
  assert.match(timing, /className="order-detail-timing"/)
  assert.match(timing, /className="order-detail-timing-row"/)
  assert.match(timing, /<dt>\{row\.label\}<\/dt>/)
  assert.match(timing, /<dd>\{row\.value\}<\/dd>/)
})

test('active order cancellation is available in details while scheduled tickets retain direct cancellation', () => {
  const orders = source('./Orders.jsx')
  const detail = source('../components/OrderDetail.jsx')
  const ticket = source('../components/KitchenTicket.jsx')

  assert.match(detail, /onRequestCancel/)
  assert.match(detail, />Cancelar pedido</)
  assert.match(orders, /onRequestCancel=\{\(\) => \{\s*setDetailOrder\(null\);?\s*setCancelOrder\(detailOrder\)\s*\}\}/s)
  assert.doesNotMatch(orders, /isScheduledWaiting\(detailOrder, now\)/)
  assert.match(ticket, /scheduled\s*\?\s*<Button[^>]*onClick=\{\(\) => onCancel\?\.\(order\)\}/s)
  assert.match(ticket, /:\s*<Button[^>]*onClick=\{\(\) => onFinalize\?\.\(order\)\}[^>]*>\{getFinalActionLabel\(order\)\}/s)
})

test('order details retain contact snapshots while kitchen tickets omit them', () => {
  const detail = source('../components/OrderDetail.jsx')
  const ticket = source('../components/KitchenTicket.jsx')

  assert.match(detail, /order\.clientPhone/)
  assert.match(detail, /order\.clientAddress/)
  assert.doesNotMatch(ticket, /order\.(?:clientPhone|clientAddress)/)
})
