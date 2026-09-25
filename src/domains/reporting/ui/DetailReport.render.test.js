import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react-test-renderer'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'

test('detail renders server page, changes filters/pagination and opens read-only drawer', async (t) => {
  const harness = await workspaceHarness(t)
  const { DetailReport } = await harness.load('/src/domains/reporting/ui/views/DetailReport.jsx')
  const patches = []
  const item = { id: 'o1', order_number: 42, order_date: '2026-09-10', client_name_snapshot: 'Ana', type: 'Entrega', status: 'Finalizado', total_cents: 1000, paidCents: 0, pendingCents: 1000, durationMinutes: 45, onTime: false }
  const orderApi = { loadOrder: async () => ({ data: { ...item, items: [{ id: 'i1', quantity: 1, name_snapshot: 'X', unit_price_cents: 1000 }], paymentAllocations: [] } }) }
  const renderer = await harness.render(DetailReport, { state: { data: { total: 2, page: 1, pageSize: 1, totalPages: 2, items: [item] }, loading: false }, query: { page: 1, pageSize: 25, sort: 'date-desc', status: 'Finalizado' }, onChange: (patch) => patches.push(patch), orderApi })
  assert.match(nodeText(renderer.root), /Pedidos \(2\)/)
  assert.match(nodeText(renderer.root), /Ana/)
  assert.match(nodeText(renderer.root), /status: Finalizado/)
  await act(async () => renderer.root.findAllByType('button').find((button) => nodeText(button) === 'Próxima').props.onClick())
  assert.deepEqual(patches.at(-1), { page: 2 })
  await act(async () => renderer.root.findAllByType('button').find((button) => button.props['aria-label'] === 'Ver pedido 42').props.onClick())
  assert.match(nodeText(renderer.root), /Itens do pedido/)
  assert.doesNotMatch(nodeText(renderer.root), /Registrar pagamento|Cancelar pedido|Imprimir pedido/)
})

test('detail product input searches a historical name without reusing the identity filter', async (t) => {
  const harness = await workspaceHarness(t)
  const { DetailReport } = await harness.load('/src/domains/reporting/ui/views/DetailReport.jsx')
  const changes = []
  const renderer = await harness.render(DetailReport, {
    state: { data: { total: 0, page: 1, totalPages: 0, items: [] }, loading: false },
    query: { view: 'detail', page: 1, pageSize: 25, sort: 'date-desc', product: 'catalog-id' },
    onChange: (patch) => changes.push(patch),
  })
  const nameInput = renderer.root.findAllByType('input').find((input) => input.props.placeholder === 'Nome histórico')
  assert.ok(nameInput)
  nameInput.props.onChange({ target: { value: 'X-Bacon' } })
  assert.deepEqual(changes.at(-1), { productName: 'X-Bacon', product: null })
})
