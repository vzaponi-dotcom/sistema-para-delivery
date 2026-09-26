import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText } from '../../../../test-support/renderWorkspace.js'

const order = {
  id: 'o186', order_number: 186, order_date: '2026-09-25', created_at: '2026-09-25T22:42:00Z',
  client_id: 'c1', client_name_snapshot: 'Teles', client_phone_snapshot: '(31) 31656-5949', client_address_snapshot: '',
  type: 'Retirada', status: 'Em preparo', subtotal_cents: 15500, total_cents: 15500,
  delivery_fee_cents: 0, adjustment_type: 'none', adjustment_amount_cents: 0,
  paidCents: 0, pendingCents: 15500, durationMinutes: null, onTime: null,
  items: [
    { id: 'i1', quantity: 1, name_snapshot: '[TESTE] Combo Família', category_snapshot: 'Combos', size_snapshot: 'Un', unit_price_cents: 7900 },
    { id: 'i2', quantity: 1, name_snapshot: '[TESTE] Combo Individual', category_snapshot: 'Combos', size_snapshot: 'Un', unit_price_cents: 2800 },
    { id: 'i3', quantity: 1, name_snapshot: '[TESTE] Combo Duplo', category_snapshot: 'Combos', size_snapshot: 'Un', unit_price_cents: 4800 },
  ],
  paymentAllocations: [
    { receipt_id: 'r1', method_code: 'pix', method_label: 'Pix', amount_cents: 5000, paid_at: '2026-09-25T22:44:00Z' },
  ],
  clientContext: {
    profile: { id: 'c1', name: 'Teles', phone: '(31) 31656-5949', address: '' },
    summary: { ordersCount: 8, totalSpentCents: 62400, averageTicketCents: 7800, pendingCents: 15500, cancellationCount: 1, lastPurchaseDate: '2026-09-25' },
    orders: [
      { id: 'o186', order_number: 186, order_date: '2026-09-25', created_at: '2026-09-25T22:42:00Z', type: 'Retirada', status: 'Em preparo', total_cents: 15500, paidCents: 0, pendingCents: 15500 },
      { id: 'o173', order_number: 173, order_date: '2026-09-18', created_at: '2026-09-18T20:00:00Z', type: 'Entrega', status: 'Finalizado', total_cents: 8200, paidCents: 8200, pendingCents: 0 },
      { id: 'o119', order_number: 119, order_date: '2026-09-02', created_at: '2026-09-02T20:00:00Z', type: 'Entrega', status: 'Cancelado', total_cents: 9300, paidCents: 0, pendingCents: 0 },
    ],
  },
}

test('reporting order drawer implements Details, History, Client and client-order views from the approved mockups', async (t) => {
  const h = await workspaceHarness(t)
  const { ReportingOrderDrawer } = await h.load('/src/domains/reporting/ui/detail/ReportingOrderDrawer.jsx')
  const openedClients = []
  const openedOrders = []
  const api = { loadOrder: async () => ({ data: order }) }
  const renderer = await h.render(ReportingOrderDrawer, {
    id: 'o186', api, onClose() {},
    onOpenClient: (client) => openedClients.push(client.id),
    onSelectOrder: (id) => openedOrders.push(id),
  })

  assert.match(nodeText(renderer.root), /Informações do pedido/)
  const tab = (name) => renderer.root.findAllByType('button').find((button) => nodeText(button) === name)

  await act(async () => tab('Histórico').props.onClick())
  const history = nodeText(renderer.root)
  assert.match(history, /Linha do tempo do pedido/)
  assert.match(history, /Pedido criado/)
  assert.match(history, /Pagamento registrado/)
  assert.match(history, /Status atual do pedido/)
  assert.equal(tab('Histórico').props['aria-selected'], true)

  await act(async () => tab('Cliente').props.onClick())
  const client = nodeText(renderer.root)
  for (const label of ['Perfil do cliente', 'Relacionamento com a loja', 'Dados deste pedido', 'Abrir cadastro do cliente', 'Ver pedidos do cliente']) {
    assert.match(client, new RegExp(label))
  }
  const openClient = renderer.root.findAllByType('button').find((button) => nodeText(button).includes('Abrir cadastro do cliente'))
  await act(async () => openClient.props.onClick())
  assert.deepEqual(openedClients, ['c1'])

  const clientOrders = renderer.root.findAllByType('button').find((button) => nodeText(button).includes('Ver pedidos do cliente'))
  await act(async () => clientOrders.props.onClick())
  const ordersText = nodeText(renderer.root)
  assert.match(ordersText, /Pedidos do cliente/)
  assert.match(ordersText, /Pedido atual/)
  assert.match(ordersText, /Pedido #173/)
  for (const filter of ['Todos', 'Finalizados', 'Pendentes', 'Cancelados']) assert.match(ordersText, new RegExp(filter))

  const previous = renderer.root.findAllByType('button').find((button) => nodeText(button).includes('Pedido #173'))
  await act(async () => previous.props.onClick())
  assert.deepEqual(openedOrders, ['o173'])
})