import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('detail renders dashboard summary, server page, filters, pagination and read-only drawer', async (t) => {
  const harness = await workspaceHarness(t)
  const { DetailReport } = await harness.load('/src/domains/reporting/ui/views/DetailReport.jsx')
  const patches = []
  const item = {
    id: 'o1', order_number: 42, order_date: '2026-09-10', created_at: '2026-09-10T12:00:00Z',
    client_name_snapshot: 'Ana', client_phone_snapshot: '11999999999', type: 'Entrega', status: 'Finalizado',
    total_cents: 1000, paidCents: 0, pendingCents: 1000, payment_label: 'Pix', durationMinutes: 45, onTime: false,
  }
  const orderApi = { loadOrder: async () => ({ data: {
    ...item, subtotal_cents: 900, delivery_fee_cents: 100, adjustment_type: 'none', adjustment_amount_cents: 0,
    items: [{ id: 'i1', quantity: 1, name_snapshot: 'X', category_snapshot: 'Lanches', unit_price_cents: 1000 }],
    paymentAllocations: [],
  } }) }
  const renderer = await harness.render(DetailReport, {
    state: {
      data: {
        total: 2, page: 1, pageSize: 25, totalPages: 2, items: [item],
        summary: { ordersCount: 2, salesCents: 2500, averageTicketCents: 1250, cancellationRate: 0 },
      },
      comparison: { metrics: {} },
      loading: false,
    },
    query: { page: 1, pageSize: 25, sort: 'date-desc', status: 'Finalizado' },
    onChange: (patch) => patches.push(patch),
    orderApi,
  })
  const text = nodeText(renderer.root)
  assert.match(text, /Pedidos no período/)
  assert.match(text, /Faturamento total/)
  assert.match(text, /Ticket médio/)
  assert.match(text, /Taxa de cancelamento/)
  assert.match(text, /Pedidos \(2\)/)
  assert.match(text, /Ana/)
  assert.match(text, /Status: Finalizado/)
  assert.match(text, /Pix/)
  assert.match(text, /Não pago/)
  assert.match(text, /Mais filtros/)

  await act(async () => renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === 'Próxima página').props.onClick())
  assert.deepEqual(patches.at(-1), { page: 2 })
  const orderRow = renderer.root.findAllByType('tr').find((row) => row.props['aria-label'] === 'Abrir pedido 42')
  assert.ok(orderRow)
  await act(async () => orderRow.props.onClick())
  assert.match(nodeText(renderer.root), /Informações do pedido/)
  assert.match(nodeText(renderer.root), /Resumo financeiro/)
  assert.match(nodeText(renderer.root), /Subtotal/)
  assert.match(nodeText(renderer.root), /Itens do pedido/)
  assert.equal(renderer.root.findAllByProps({ href: '/financeiro/a-receber' }).length, 1)
  assert.match(nodeText(renderer.root), /Gerenciar em A receber/)
  assert.doesNotMatch(nodeText(renderer.root), /Registrar pagamento|Cancelar pedido|Imprimir pedido/)
})

test('detail keeps product drilldown filters readable without exposing manual category/product inputs', async (t) => {
  const harness = await workspaceHarness(t)
  const { DetailReport } = await harness.load('/src/domains/reporting/ui/views/DetailReport.jsx')
  const changes = []
  const renderer = await harness.render(DetailReport, {
    state: {
      data: {
        total: 0, page: 1, pageSize: 25, totalPages: 0, items: [],
        summary: { ordersCount: 0, salesCents: 0, averageTicketCents: null, cancellationRate: null },
      },
      loading: false,
    },
    query: { view: 'detail', page: 1, pageSize: 25, sort: 'date-desc', product: 'catalog-id' },
    onChange: (patch) => changes.push(patch),
  })
  const text = nodeText(renderer.root)
  assert.doesNotMatch(text, /Produto por nome/)
  assert.match(text, /Produto: Selecionado/)
  renderer.root.findAllByType('button').find((button) => nodeText(button).includes('Produto: Selecionado')).props.onClick()
  assert.deepEqual(changes.at(-1), { product: null, page: 1 })
})
