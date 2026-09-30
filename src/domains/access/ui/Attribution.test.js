import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceHarness, nodeText } from '../../../test-support/renderWorkspace.js'
import { getPrintJobDetails } from '../../printing/ui/printQueueDetails.js'
test('print attribution uses server actors and ignores an old label without evidence', () => {
  const details = getPrintJobDetails({ attribution: { requestedBy: { type: 'system', displayName: 'fake' }, lastActionBy: { type: 'user', displayName: 'Maria' } }, actionActorLabel: 'First manager' })
  assert.equal(details.requestedBy, 'Sistema'); assert.equal(details.audit.actor, 'Maria')
  const historical = getPrintJobDetails({ actionActorLabel: 'First manager' })
  assert.equal(historical.requestedBy, 'Autor não identificado'); assert.equal(historical.audit.actor, 'Autor não identificado')
  assert.equal(getPrintJobDetails(null).audit.actor, 'Autor não identificado')
})
test('order detail presents creation finalization and receipt server actors with truthful fallback', async t => {
  const h = await workspaceHarness(t)
  const { default: OrderDetail } = await h.load('/src/domains/orders/ui/components/OrderDetail.jsx')
  const screen = await h.render(OrderDetail, { order: { id: 'o', client: 'Ana', type: 'Retirada', orderDate: '2026-09-30', status: 'Finalizado', paymentStatus: 'Pago', items: [], attribution: { createdBy: { type: 'user', displayName: 'Otávio' }, finalizedBy: { type: 'legacy', displayName: 'fake' }, paidBy: { type: 'system', displayName: 'fake' } } }, currency: v => String(v), onClose() {} })
  const text = nodeText(screen.root)
  assert.match(text, /Criado porOtávio/); assert.match(text, /Finalizado porAcesso legado/); assert.match(text, /Recebido porSistema/)
})
